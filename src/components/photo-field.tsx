import { useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import type { Petition } from '../domain/model';
import { PickedPhoto, pickPhoto } from '../data/photos';
import { useBackend, useCommand } from '../data/provider';
import { toast } from './kit';
import { Button, Field, Notice, colors, fonts, styles } from './ui';

export interface PhotoValue {
  /** A data URI before upload, or the stored URL. */
  uri: string;
  alt: string;
  /** Present until the picked photo has been uploaded. */
  picked?: PickedPhoto;
}

/**
 * One photo of the problem, with the short description screen readers announce. Picking, resizing
 * and metadata stripping all happen on the device (src/data/photos.ts).
 */
export function PhotoField({
  value,
  onChange,
  disabled = false,
}: {
  value: PhotoValue | null;
  onChange: (next: PhotoValue | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  async function choose(source: 'camera' | 'library') {
    setError('');
    setWorking(true);
    try {
      const picked = await pickPhoto(source);
      if (picked) onChange({ uri: picked.uri, alt: value?.alt ?? '', picked });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That photo could not be used.');
    } finally {
      setWorking(false);
    }
  }
  const busy = disabled || working;
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
        Photo of the problem (optional)
      </Text>
      {value ? (
        <>
          <Image
            source={{ uri: value.uri }}
            accessibilityLabel={value.alt || 'Petition photo'}
            resizeMode="cover"
            style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 20 }}
          />
          <Field
            label="Describe the photo for people using screen readers"
            value={value.alt}
            onChangeText={(alt) => onChange({ ...value, alt })}
            placeholder="The unlit path between the bus stop and campus at night"
            maxLength={200}
            error={
              value.alt.trim().length < 5 ? 'Add a short description (5+ characters).' : undefined
            }
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button
              title="Replace"
              variant="secondary"
              disabled={busy}
              onPress={() => void choose('library')}
              style={{ flex: 1 }}
            />
            <Button
              title="Remove"
              variant="ghost"
              disabled={busy}
              onPress={() => onChange(null)}
              style={{ flex: 1 }}
            />
          </View>
        </>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {Platform.OS !== 'web' && (
            <Button
              title="Take photo"
              variant="secondary"
              disabled={busy}
              onPress={() => void choose('camera')}
              style={{ flex: 1 }}
            />
          )}
          <Button
            title={working ? 'Preparing…' : 'Choose photo'}
            variant="secondary"
            disabled={busy}
            onPress={() => void choose('library')}
            style={{ flex: 1 }}
          />
        </View>
      )}
      <Text style={[styles.micro, { fontSize: 12 }]}>
        Show the problem, not people: avoid faces and license plates. Location data is removed from
        the photo before it leaves your device.
      </Text>
      {!!error && <Notice error text={error} />}
    </View>
  );
}

/** Saves a photo change through the backend: upload when new, then the public photo command. */
export async function savePhoto(
  adapter: { uploadPhoto(jpegBase64: string): Promise<string> },
  value: PhotoValue | null,
) {
  if (!value) return null;
  const url = value.picked ? await adapter.uploadPhoto(value.picked.base64) : value.uri;
  return { url, alt: value.alt.trim() };
}

/** Manage: change or remove a published petition's photo; each save is a public edit. */
export function ManagePhoto({ petition: p }: { petition: Petition }) {
  const { adapter } = useBackend();
  const m = useCommand();
  // undefined until the organizer touches it, so the field starts from the saved photo.
  const [edited, setEdited] = useState<PhotoValue | null | undefined>(undefined);
  const value =
    edited === undefined ? (p.photo ? { uri: p.photo.url, alt: p.photo.alt } : null) : edited;
  async function save() {
    try {
      await m.mutateAsync({
        type: 'photo',
        petitionId: p.id,
        photo: await savePhoto(adapter, value),
      });
      setEdited(undefined);
      toast(value ? 'Photo saved. The change is in the public edit history.' : 'Photo removed.');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'The photo could not be saved.');
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <PhotoField value={value} onChange={setEdited} disabled={m.isPending} />
      {edited !== undefined && (
        <Button
          title={m.isPending ? 'Saving…' : value ? 'Save photo' : 'Remove photo'}
          disabled={m.isPending || (!!value && value.alt.trim().length < 5)}
          onPress={() => void save()}
        />
      )}
    </View>
  );
}
