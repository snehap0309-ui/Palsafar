import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Pal } from '../design/DesignSystem';
import { GlassCard } from '../components/ui/GlassCard';
import { useTheme } from '../context/ThemeContext';
import { useUserContext } from '../context/UserContext';
import { useHeaderSafePadding } from '../design/responsive';
import type { LegalDocumentType } from '../services/api/legal';

interface LegalHubItem {
  type: LegalDocumentType;
  label: string;
  emoji: string;
}

interface LegalHubGroup {
  title: string;
  items: LegalHubItem[];
}

const BASE_GROUPS: LegalHubGroup[] = [
  {
    title: 'Legal & Policies',
    items: [
      { type: 'PRIVACY_POLICY', label: 'Privacy Policy', emoji: '🔏' },
      { type: 'TERMS_CONDITIONS', label: 'Terms & Conditions', emoji: '📄' },
      { type: 'REWARDS_POLICY', label: 'Rewards Policy', emoji: '🎁' },
      { type: 'COMMUNITY_GUIDELINES', label: 'Community Guidelines', emoji: '🤝' },
      { type: 'REFUND_POLICY', label: 'Refund Policy', emoji: '💳' },
    ],
  },
  {
    title: 'Company',
    items: [
      { type: 'ABOUT_US', label: 'About Us', emoji: 'ℹ️' },
      { type: 'CONTACT_INFO', label: 'Contact Information', emoji: '✉️' },
      { type: 'FAQ', label: 'Frequently Asked Questions', emoji: '❓' },
    ],
  },
];

function workspaceRoleGroup(activeMode?: string | null): LegalHubGroup | null {
  const mode = String(activeMode || 'USER').toUpperCase();
  if (mode === 'CONTENT_CREATOR' || mode === 'CREATOR') {
    return {
      title: 'For Creators',
      items: [{ type: 'CREATOR_TERMS', label: 'Creator Terms', emoji: '🎬' }],
    };
  }
  if (mode === 'VENDOR') {
    return {
      title: 'For Vendors',
      items: [{ type: 'VENDOR_TERMS', label: 'Vendor Terms', emoji: '🏪' }],
    };
  }
  return null;
}

interface LegalHubScreenProps {
  onBack?: () => void;
  onSelect?: (type: LegalDocumentType, label: string) => void;
}

export default function LegalHubScreen({ onBack, onSelect }: LegalHubScreenProps) {
  const { theme } = useTheme();
  const headerPadTop = useHeaderSafePadding(12);
  const { user } = useUserContext();

  const groups = useMemo(() => {
    const roleGroup = workspaceRoleGroup(user?.activeMode || user?.activeRole);
    if (!roleGroup) return BASE_GROUPS;
    // Insert role terms after general legal policies, before company
    return [BASE_GROUPS[0], roleGroup, BASE_GROUPS[1]];
  }, [user?.activeMode, user?.activeRole]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background }} showsVerticalScrollIndicator={false}>
      <View style={{ padding: Pal.spacing[5], paddingTop: headerPadTop, gap: Pal.spacing[6] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity onPress={onBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.glass, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: theme.text, fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: Pal.typography.fontFamily.bold, fontSize: 22, color: theme.text }}>Terms & Conditions</Text>
        </View>

        {groups.map((group) => (
          <View key={group.title}>
            <Text style={{ fontFamily: Pal.typography.fontFamily.semibold, fontSize: 15, color: theme.textMuted, marginBottom: Pal.spacing[3], paddingLeft: Pal.spacing[1] }}>
              {group.title}
            </Text>
            <GlassCard padding={0}>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.type}
                  onPress={() => onSelect?.(item.type, item.label)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: Pal.spacing[5], paddingVertical: Pal.spacing[4], borderBottomWidth: i < group.items.length - 1 ? 1 : 0, borderBottomColor: theme.border + '40' }}
                >
                  <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
                  <Text style={{ flex: 1, fontFamily: Pal.typography.fontFamily.medium, fontSize: 15, color: theme.text }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 18 }}>›</Text>
                </TouchableOpacity>
              ))}
            </GlassCard>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
