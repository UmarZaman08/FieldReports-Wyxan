import {
  CameraIcon,
  ImagesIcon,
  TrashIcon,
  FileTextIcon,
  ClockIcon,
} from '../../assets';
import React, { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import ImageResizer from '@bam.tech/react-native-image-resizer';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { Button } from '../../components/common/Button';
import { SectionHeading } from '../../components/common/SectionHeading';
import { Screen } from '../../components/common/Screen';
import {
  ToastMessage,
  type ToastStatus,
} from '../../components/common/ToastMessage';
import { theme } from '../../constants/theme';
import type { AppSession, RootStackParamList } from '../../navigation/types';
import { SessionContext } from '../../session';
import type { TemporaryImage } from '../../types/report';
import BlobUtil from 'react-native-blob-util';
import { filePath } from '../../services/image/storage';
import { usePreventRemove } from '@react-navigation/native';
import {
  MAX_IMAGE_BYTES,
  MAX_REPORT_IMAGES,
  validateReport,
} from './validation';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateReport'>;
interface ToastNotice {
  status: ToastStatus;
  title: string;
  message: string;
}

export function CreateReportScreen({
  navigation,
  route,
}: Props): React.JSX.Element {
  const session = useContext(SessionContext) as AppSession;
  const existing = session.reports.find(
    report => report.id === route.params?.reportId,
  );
  const [reportId, setReportId] = useState(existing?.id);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [images, setImages] = useState<TemporaryImage[]>(
    existing?.images ?? [],
  );
  const busy = useRef(false);
  const allowNavigationAfterSave = useRef(false);
  const knownReportIds = useRef(new Set(existing ? [existing.id] : []));
  const temporaryPaths = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [baseline, setBaseline] = useState(
    JSON.stringify([existing?.description ?? '', existing?.images ?? []]),
  );
  const dirty = JSON.stringify([description, images]) !== baseline;
  const [processing, setProcessing] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);
  usePreventRemove(dirty || saving || processing, ({ data }) => {
    if (allowNavigationAfterSave.current) {
      allowNavigationAfterSave.current = false;
      navigation.dispatch(data.action);
      return;
    }
    if (busy.current) return;
    Alert.alert(
      'Unsaved changes',
      'Save your draft before leaving, or discard these edits.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard edits',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    );
  });
  useEffect(
    () => () => {
      for (const path of temporaryPaths.current)
        BlobUtil.fs.unlink(path).catch(() => undefined);
    },
    [],
  );
  useEffect(() => {
    if (reportId && session.reports.some(report => report.id === reportId)) {
      knownReportIds.current.add(reportId);
      return;
    }
    if (reportId && knownReportIds.current.has(reportId)) {
      setReportId(undefined);
      setDescription('');
      setImages([]);
      setBaseline(JSON.stringify(['', []]));
      setToast({
        status: 'success',
        title: 'Report sent',
        message:
          'The server confirmed the report. Its local copy and photos were removed.',
      });
    }
  }, [reportId, session.reports]);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [toast, setToast] = useState<ToastNotice | null>(null);

  function clearComposer(): void {
    setReportId(undefined);
    setDescription('');
    setImages([]);
    setBaseline(JSON.stringify(['', []]));
    setValidationMessage(null);
    setError(null);
    setToast(null);
  }

  async function processAsset(
    asset: Asset,
    index: number,
  ): Promise<TemporaryImage> {
    if (!asset.uri || !asset.width || !asset.height)
      throw new Error(
        'This photo could not be opened. Please choose another image.',
      );
    const attempts = [
      { edge: 1600, quality: 88 },
      { edge: 1280, quality: 78 },
      { edge: 1024, quality: 68 },
      { edge: 800, quality: 58 },
    ];
    for (const attempt of attempts) {
      const resized = await ImageResizer.createResizedImage(
        asset.uri,
        attempt.edge,
        attempt.edge,
        'JPEG',
        attempt.quality,
        0,
        undefined,
        false,
        { onlyScaleDown: true },
      );
      const path = filePath(resized.uri);
      temporaryPaths.current.add(path);
      const size = Number((await BlobUtil.fs.stat(path)).size);
      if (size > 0 && size <= MAX_IMAGE_BYTES) {
        return {
          id: `${Date.now()}-${index}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          uri: resized.uri,
          name: resized.name,
          size,
          width: resized.width,
          height: resized.height,
        };
      }
      await BlobUtil.fs.unlink(path);
      temporaryPaths.current.delete(path);
    }
    throw new Error(
      'This photo is still over 5 MB after compression. Choose a smaller image or crop it before selecting it.',
    );
  }

  function handlePickerResponse(response: ImagePickerResponse): Asset[] {
    if (response.didCancel) return [];
    if (response.errorCode) {
      const detail =
        response.errorCode === 'permission'
          ? 'Permission was denied. Allow access in device settings, then try again.'
          : response.errorCode === 'camera_unavailable'
          ? 'The camera is unavailable on this device.'
          : response.errorMessage || 'The photo could not be selected.';
      setError(detail);
      setToast({
        status: response.errorCode === 'permission' ? 'warning' : 'error',
        title:
          response.errorCode === 'permission'
            ? 'Permission needed'
            : 'Photo unavailable',
        message: detail,
      });
      return [];
    }
    setError(null);
    return response.assets ?? [];
  }

  async function pickPhotos(source: 'camera' | 'gallery'): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    const remaining = MAX_REPORT_IMAGES - images.length;
    if (remaining <= 0) {
      const detail =
        'You have reached the five photo limit. Remove a photo to add another.';
      setError(detail);
      setToast({
        status: 'warning',
        title: 'Photo limit reached',
        message: detail,
      });
      busy.current = false;
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const response =
        source === 'camera'
          ? await launchCamera({
              mediaType: 'photo',
              cameraType: 'back',
              quality: 1,
              saveToPhotos: false,
            })
          : await launchImageLibrary({
              mediaType: 'photo',
              selectionLimit: remaining,
              quality: 1,
              includeBase64: false,
            });
      const assets = handlePickerResponse(response).slice(0, remaining);
      if (assets.length === 0) return;
      const processed: TemporaryImage[] = [];
      for (const [index, asset] of assets.entries())
        processed.push(await processAsset(asset, index));
      setImages(current =>
        [...current, ...processed].slice(0, MAX_REPORT_IMAGES),
      );
      setValidationMessage(null);
    } catch (pickerError) {
      const detail =
        pickerError instanceof Error
          ? pickerError.message
          : 'Something went wrong while processing the photo. Please try again.';
      setError(detail);
      setToast({
        status: 'error',
        title: 'Photo could not be added',
        message: detail,
      });
    } finally {
      setProcessing(false);
      busy.current = false;
    }
  }

  async function saveReport(queue: boolean): Promise<void> {
    if (busy.current) return;
    const message = queue ? validateReport(description, images.length) : null;
    setValidationMessage(message);
    if (message) {
      setToast({ status: 'warning', title: 'Check your report', message });
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await session.service.save(description, images, reportId, queue);
      if (queue) session.service.queue.run().catch(() => undefined);
      clearComposer();
      allowNavigationAfterSave.current = true;
      navigation.reset({
        index: 0,
        routes: [{ name: queue ? 'Home' : 'Drafts' }],
      });
    } catch (failure) {
      setToast({
        status: 'error',
        title: 'Could not complete save',
        message:
          failure instanceof Error
            ? failure.message
            : 'Storage unavailable. Try again.',
      });
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }
  const currentReport = reportId
    ? session.reports.find(report => report.id === reportId)
    : undefined;
  const queued = currentReport !== undefined && currentReport.state !== 'draft';

  return (
    <Screen scroll={false} topSafeArea={false}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View pointerEvents="box-none" style={styles.toastHost}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.introBlock}>
              <Text style={styles.eyebrow}>FIELD NOTE</Text>
              <Text style={styles.intro}>
                Capture the details while you are on site.
              </Text>
            </View>
            <View style={styles.formCard}>
              <Text style={styles.label}>
                Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                value={description}
                onChangeText={text => {
                  setDescription(text);
                  if (validationMessage) setValidationMessage(null);
                }}
                placeholder="What did you observe?"
                placeholderTextColor={theme.colors.muted}
                multiline
                editable={!saving && !queued}
                maxLength={500}
                textAlignVertical="top"
                onFocus={() => setDescriptionFocused(true)}
                onBlur={() => setDescriptionFocused(false)}
                accessibilityLabel="Report description"
                style={[
                  styles.input,
                  validationMessage?.startsWith('Add a short') &&
                    styles.inputError,
                  descriptionFocused &&
                    !validationMessage &&
                    styles.inputFocused,
                ]}
              />
              <Text style={styles.characterCount}>
                {description.length}/500
              </Text>
              {validationMessage?.startsWith('Add a short') ? (
                <Text style={styles.validation}>{validationMessage}</Text>
              ) : null}
            </View>
            <View style={styles.photoHeading}>
              <SectionHeading
                title="Photos"
                detail={`${images.length}/${MAX_REPORT_IMAGES}`}
              />
              <Text style={styles.photoHint}>Add 1 to 5 photos</Text>
            </View>
            {images.length > 0 ? (
              <View style={styles.imageGrid}>
                {images.map(image => (
                  <View key={image.id} style={styles.imageWrap}>
                    <Image
                      source={{ uri: image.uri }}
                      style={styles.image}
                      accessibilityLabel="Selected report photo"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Remove photo"
                      disabled={saving || queued || processing}
                      onPress={() =>
                        setImages(current =>
                          current.filter(item => item.id !== image.id),
                        )
                      }
                      style={styles.remove}
                    >
                      <TrashIcon
                        width={16}
                        height={16}
                        stroke={theme.colors.white}
                        accessible={false}
                      />
                    </Pressable>
                    <Text style={styles.imageSize}>
                      {(image.size / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.photoEmpty}>
                <ImagesIcon
                  width={25}
                  height={25}
                  color={theme.colors.primary}
                  style={styles.photoEmptyIcon}
                  accessible={false}
                />
                <Text style={styles.photoEmptyTitle}>No photos added</Text>
                <Text style={styles.photoEmptyText}>
                  Images are resized and checked to stay within 5 MB each.
                </Text>
              </View>
            )}
            {error ? (
              <View accessibilityRole="alert" style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {validationMessage &&
            !validationMessage.startsWith('Add a short') ? (
              <Text style={styles.validation}>{validationMessage}</Text>
            ) : null}
            <View style={styles.pickerButtons}>
              <Button
                label="Take photo"
                icon={CameraIcon}
                onPress={() => {
                  pickPhotos('camera').catch(() => undefined);
                }}
                secondary
                disabled={
                  saving ||
                  queued ||
                  processing ||
                  images.length >= MAX_REPORT_IMAGES
                }
                style={styles.pickerButton}
              />
              <Button
                label="Choose photos"
                icon={ImagesIcon}
                onPress={() => {
                  pickPhotos('gallery').catch(() => undefined);
                }}
                secondary
                disabled={
                  saving ||
                  queued ||
                  processing ||
                  images.length >= MAX_REPORT_IMAGES
                }
                style={styles.pickerButton}
              />
            </View>
            {processing ? (
              <View style={styles.processing}>
                <Text style={styles.processingText}>
                  Compressing photo and checking file size…
                </Text>
              </View>
            ) : null}
            <View style={styles.nextStepCard}>
              <Text style={styles.nextStepTitle}>Save or submit</Text>
              <Text style={styles.nextStepText}>
                A draft stays on this device. Submitted reports wait here until
                the server confirms them.
              </Text>
            </View>
            <Button
              label="Save draft"
              icon={FileTextIcon}
              onPress={() => {
                saveReport(false).catch(() => undefined);
              }}
              secondary
              disabled={processing || saving || queued}
              style={styles.submit}
            />
            <Button
              label={queued ? 'Queued locally' : 'Submit report'}
              icon={ClockIcon}
              onPress={() => {
                saveReport(true).catch(() => undefined);
              }}
              loading={saving}
              disabled={processing || queued}
              style={styles.submit}
            />
          </ScrollView>
          {toast ? (
            <ToastMessage
              status={toast.status}
              title={toast.title}
              message={toast.message}
              onDismiss={() => setToast(null)}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  toastHost: { flex: 1, position: 'relative' },
  content: { paddingBottom: theme.space.xl },
  introBlock: { marginBottom: theme.space.md },
  eyebrow: {
    color: theme.colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 5,
  },
  intro: {
    color: theme.colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  formCard: {
    padding: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
  },
  label: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  required: { color: theme.colors.danger },
  input: {
    minHeight: 112,
    marginTop: 10,
    padding: 12,
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 21,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
  },
  inputError: { borderColor: theme.colors.danger },
  inputFocused: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  characterCount: {
    color: theme.colors.muted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 5,
  },
  validation: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  photoHeading: { marginTop: theme.space.xl, marginBottom: theme.space.md },
  photoHint: { color: theme.colors.muted, fontSize: 12, marginTop: 6 },
  photoEmpty: {
    alignItems: 'center',
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderStyle: 'dashed',
    borderRadius: theme.radius.md,
  },
  photoEmptyIcon: {
    marginBottom: 7,
  },
  photoEmptyTitle: { color: theme.colors.ink, fontWeight: '700', fontSize: 14 },
  photoEmptyText: {
    color: theme.colors.muted,
    textAlign: 'center',
    fontSize: 12,
    marginTop: 5,
  },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  imageWrap: {
    width: '31%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.line,
  },
  remove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(14,38,69,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageSize: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: theme.colors.white,
    fontSize: 10,
    fontWeight: '700',
    backgroundColor: 'rgba(14,38,69,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  errorBox: {
    marginTop: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: '#FCEBED',
    padding: 11,
  },
  errorText: { color: theme.colors.danger, fontSize: 12, lineHeight: 18 },
  pickerButtons: { flexDirection: 'row', gap: 10, marginTop: theme.space.md },
  pickerButton: { flex: 1, paddingHorizontal: 8 },
  processing: {
    marginTop: 11,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.radius.sm,
    padding: 11,
  },
  processingText: {
    color: theme.colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  nextStepCard: {
    marginTop: theme.space.lg,
    padding: theme.space.md,
    backgroundColor: theme.colors.primaryTint,
    borderRadius: theme.radius.md,
  },
  nextStepTitle: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  nextStepText: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  submit: { marginTop: theme.space.md },
});
