import type { TemporaryImage } from '../../types/report';
import { MAX_IMAGE_BYTES } from '../../screens/Draft/validation';
export interface FileSystem {
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{ size: number | string }>;
  mkdir(path: string): Promise<unknown>;
  cp(source: string, target: string): Promise<unknown>;
  unlink(path: string): Promise<unknown>;
  ls(path: string): Promise<string[]>;
}
export const filePath = (uri: string): string => uri.replace(/^file:\/\//, '');
export class ImageStorage {
  constructor(private fs: FileSystem, readonly root: string) {}
  async initialize(): Promise<void> {
    if (!(await this.fs.exists(this.root))) await this.fs.mkdir(this.root);
  }
  async verify(image: TemporaryImage): Promise<void> {
    const path = filePath(image.uri);
    if (!(await this.fs.exists(path)))
      throw new Error(
        'A report photo is missing. Restore the photo before uploading.',
      );
    const size = Number((await this.fs.stat(path)).size);
    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > MAX_IMAGE_BYTES ||
      size !== image.size
    )
      throw new Error('A photo is empty, changed, or exceeds 5 MB.');
  }
  async copy(image: TemporaryImage, filename: string): Promise<TemporaryImage> {
    await this.verify(image);
    const uri = `${this.root}/${filename}.jpg`;
    try {
      await this.fs.cp(filePath(image.uri), uri);
      const saved = { ...image, uri: `file://${uri}` };
      await this.verify(saved);
      return saved;
    } catch (error) {
      if (await this.fs.exists(uri)) await this.fs.unlink(uri);
      throw error;
    }
  }
  async clean(referenced: string[]): Promise<void> {
    const keep = new Set(referenced.map(filePath));
    for (const name of await this.fs.ls(this.root)) {
      const path = `${this.root}/${name}`;
      if (!keep.has(path)) await this.fs.unlink(path);
    }
  }
}
