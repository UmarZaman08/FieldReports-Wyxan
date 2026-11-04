import React, { useContext } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../../components/common/Screen';
import { Button } from '../../components/common/Button';
import { theme } from '../../constants/theme';
import type { AppSession, RootStackParamList } from '../../navigation/types';
import { SessionContext } from '../../session';

type Props = NativeStackScreenProps<RootStackParamList, 'Drafts'>;

export function DraftsScreen({ navigation }: Props): React.JSX.Element {
  const session = useContext(SessionContext) as AppSession;
  const reports = session.temporaryReports;

  return <Screen scroll={false}><Text style={styles.eyebrow}>REPORT WORKSPACE</Text><Text style={styles.title}>Drafts</Text><Text style={styles.intro}>Temporary selections in this app session.</Text>
    {reports.length === 0 ? <View style={styles.empty}><View style={styles.emptyMark}><Text style={styles.emptyIcon}>▤</Text></View><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.emptyText}>Reports you create will appear here for this session. They are not saved after the app closes.</Text><Button label="Create a report" onPress={() => navigation.navigate('CreateReport')} style={styles.button} /></View> : <FlatList data={reports} keyExtractor={item => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.card}><View style={styles.cardTop}><Text style={styles.badge}>TEMPORARY</Text><Text style={styles.time}>{new Date(item.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></View><Text style={styles.description} numberOfLines={3}>{item.description}</Text><View style={styles.cardBottom}><View style={styles.thumbs}>{item.images.slice(0, 3).map(image => <Image key={image.id} source={{ uri: image.uri }} style={styles.thumb} />)}</View><Text style={styles.imageCount}>{item.images.length} {item.images.length === 1 ? 'photo' : 'photos'}</Text></View></View>} />}
  </Screen>;
}

const styles = StyleSheet.create({ eyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginTop: 8 }, title: { color: theme.colors.ink, fontSize: 30, fontWeight: '800', marginTop: 6 }, intro: { color: theme.colors.muted, fontSize: 14, marginTop: 5 }, empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space.md, paddingBottom: 60 }, emptyMark: { width: 64, height: 64, backgroundColor: theme.colors.primaryTint, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 18 }, emptyIcon: { color: theme.colors.primary, fontSize: 25 }, emptyTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: '800' }, emptyText: { color: theme.colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }, button: { alignSelf: 'stretch', marginTop: theme.space.lg }, list: { paddingTop: theme.space.lg, paddingBottom: theme.space.xl }, card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space.md, marginBottom: theme.space.md, borderWidth: 1, borderColor: theme.colors.line }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { color: theme.colors.amber, backgroundColor: theme.colors.amberTint, overflow: 'hidden', borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 }, time: { color: theme.colors.muted, fontSize: 12 }, description: { color: theme.colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 22, marginTop: 14 }, cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 12 }, thumbs: { flexDirection: 'row', gap: 6 }, thumb: { width: 38, height: 38, borderRadius: 8, backgroundColor: theme.colors.background }, imageCount: { color: theme.colors.muted, fontSize: 12, fontWeight: '600' } });
