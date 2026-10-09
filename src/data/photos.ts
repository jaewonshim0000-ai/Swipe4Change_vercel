import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { fromBase64, stripJpegMetadata, toBase64 } from '../domain/jpeg';

export interface PickedPhoto {
  /** Metadata-free JPEG, ready for adapter.uploadPhoto. */
  base64: string;
  /** For previews before the photo is uploaded. */
  uri: string;
}

/**
 * Takes or chooses a photo, then on the device shrinks it to 1200 px wide, re-saves it as a JPEG
 * and strips every metadata segment, so the GPS position a phone records never leaves it.
 * Returns null when the person cancels.
 */
export async function pickPhoto(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      source === 'camera' ? 'Camera access was declined.' : 'Photo library access was declined.',
    );
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 1, exif: false };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (!asset.width || asset.width > 1200) context.resize({ width: 1200 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('The photo could not be prepared. Try another one.');
  const base64 = toBase64(stripJpegMetadata(fromBase64(saved.base64.replace(/^data:[^,]+,/, ''))));
  return { base64, uri: `data:image/jpeg;base64,${base64}` };
}
