import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserContext } from '../context/UserContext';
import { useDataContext } from '../context/DataContext';
import { useBottomSafePadding } from '../design/responsive';
import { colors } from '../config/theme';
import { Button } from '../components/ui';

interface CreateReelScreenProps {
  onBack: () => void;
  onSaveReel: (
    data: { videoUri: string; caption: string; spotId: string; spotName?: string; tags: string[] },
    onProgress?: (p: number) => void
  ) => Promise<void>;
  uploadProgress?: number;
}

const REEL_TAGS = [
  'Travel', 'Food', 'History', 'Adventure', 'Hidden Gems',
  'Events', 'Shopping', 'Temple', 'Nature', 'Culture',
];

export default function CreateReelScreen({
  onBack,
  onSaveReel,
  uploadProgress = 0,
}: CreateReelScreenProps) {
  const { user } = useUserContext();
  const { currentVendor } = useDataContext();
  const insets = useSafeAreaInsets();
  const contentPadBottom = useBottomSafePadding(24);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const roles = user?.roles?.length
    ? user.roles
    : [user?.activeRole || (user?.role === 'vendor' ? 'VENDOR' : user?.role === 'creator' ? 'CONTENT_CREATOR' : 'USER')];
  const vendorApproved =
    (roles.includes('VENDOR') || user?.permission === 'VENDOR')
    && (currentVendor?.verificationStatus === 'approved'
      || String(currentVendor?.verificationStatus || '').toUpperCase() === 'APPROVED');
  const creatorApproved =
    (roles.includes('CONTENT_CREATOR') || user?.permission === 'CONTENT_CREATOR')
    && (user?.creatorProfile?.status === 'APPROVED');
  const canUpload = vendorApproved || creatorApproved;

  const uploadRoleLabel = vendorApproved ? 'vendor' : creatorApproved ? 'creator' : null;

  const handlePickVideo = useCallback(async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'video',
        selectionLimit: 1,
      });
      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setVideoUri(asset.uri || null);
        setVideoThumbnail(null);
      }
    } catch {
      Alert.alert('Error', 'Failed to pick video.');
    }
  }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const handlePost = useCallback(async () => {
    if (!videoUri) {
      Alert.alert('Error', 'Please select a video.');
      return;
    }
    if (!caption.trim()) {
      Alert.alert('Error', 'Please add a caption.');
      return;
    }
    setUploading(true);
    try {
      await onSaveReel({
        videoUri,
        caption: caption.trim(),
        spotId: '',
        spotName: '',
        tags: selectedTags,
      }, (progress) => {});
      Alert.alert('Success', 'Reel posted successfully!');
      onBack();
    } catch {
      Alert.alert('Error', 'Failed to post reel. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [videoUri, caption, selectedTags, onSaveReel, onBack]);

  if (!canUpload) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Icon name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Reel</Text>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.unauthorizedContainer}>
          <Icon name="lock-closed" size={64} color="rgba(255,255,255,0.2)" />
          <Text style={styles.unauthorizedTitle}>Upload Unavailable</Text>
          <Text style={styles.unauthorizedText}>
            Only approved Vendors and Content Creators can upload reels.
          </Text>
          <Text style={styles.unauthorizedHint}>
            {uploadRoleLabel
              ? 'Your account status does not allow uploading yet.'
              : 'Apply as a creator from Profile, or log in as an approved vendor.'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Icon name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Reel</Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={uploading || !videoUri}
          style={[styles.postBtn, (!videoUri || uploading) && { opacity: 0.4 }]}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postBtnText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: contentPadBottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Video Picker */}
        <TouchableOpacity style={styles.videoPicker} onPress={handlePickVideo}>
          {videoThumbnail ? (
            <Image source={{ uri: videoThumbnail }} style={styles.videoThumb} resizeMode="cover" />
          ) : videoUri ? (
            <View style={[styles.videoThumb, styles.videoThumbPlaceholder]}>
              <Icon name="videocam" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Video selected</Text>
            </View>
          ) : (
            <View style={[styles.videoThumb, styles.videoThumbPlaceholder]}>
              <Icon name="cloud-upload" size={48} color="rgba(255,255,255,0.3)" />
              <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 8 }}>Tap to select video</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Upload Progress */}
        {uploading && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{uploadProgress}%</Text>
          </View>
        )}

        {/* Caption */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Caption</Text>
          <TextInput
            style={styles.captionInput}
            placeholder="Write a caption..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={caption}
            onChangeText={setCaption}
            multiline
            maxLength={2000}
          />
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.tagsRow}>
            {REEL_TAGS.map(tag => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  selectedTags.includes(tag) && styles.tagActive,
                ]}
                onPress={() => handleToggleTag(tag)}
              >
                <Text style={[
                  styles.tagText,
                  selectedTags.includes(tag) && styles.tagTextActive,
                ]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  postBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  videoPicker: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  videoThumbPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  progressContainer: {
    marginBottom: 20,
    gap: 6,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'right',
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  tagActive: {
    backgroundColor: 'rgba(0,139,139,0.2)',
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  tagTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  unauthorizedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 12,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  unauthorizedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
  unauthorizedHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
});
