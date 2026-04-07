declare module "browser-image-compression" {
  interface ImageCompressionOptions {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    useWebWorker?: boolean;
    initialQuality?: number;
  }

  export default function imageCompression(file: File, options?: ImageCompressionOptions): Promise<File>;
}
