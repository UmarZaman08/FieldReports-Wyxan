export interface TemporaryImage {
  id: string;
  uri: string;
  name: string;
  size: number;
  width: number;
  height: number;
}

export interface TemporaryReport {
  id: string;
  description: string;
  images: TemporaryImage[];
  createdAt: number;
}
