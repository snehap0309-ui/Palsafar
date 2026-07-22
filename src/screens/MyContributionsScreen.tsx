import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { colors, spacing, borderRadius } from '../config/theme';
import { MaterialIcons } from '../utils/Icons';
import { HiddenGemSubmission } from '../types';
import { useHeaderSafePadding } from '../design/responsive';

interface MyContributionsScreenProps {
  onBack: () => void;
  userId: string;
  submissions: HiddenGemSubmission[];
  onAddNew: () => void;
}

export default function MyContributionsScreen({ onBack, userId, submissions, onAddNew }: MyContributionsScreenProps) {
  const headerPadTop = useHeaderSafePadding(12);
  const mySubmissions = useMemo(() => 
    submissions.filter(s => s.userId === userId).sort((a, b) => b.submittedAt - a.submittedAt),
    [submissions, userId]
  );

  const pendingCount = useMemo(() => mySubmissions.filter(s => s.status === 'pending').length, [mySubmissions]);
  const approvedCount = useMemo(() => mySubmissions.filter(s => s.status === 'approved').length, [mySubmissions]);

  const totalPoints = useMemo(() => mySubmissions.filter(s => s.status === 'approved').reduce((sum, s) => sum + s.pointsReward, 0), [mySubmissions]);

  const getCategoryEmoji = (category: string): string => {
    const emojiMap: Record<string, string> = {
      waterfall: '💧', sunset_point: '🌅', old_temple: '🛕', local_viewpoint: '🏔️',
      photo_spot: '📸', river_ghat: '🌊', small_fort: '🏰', nature_trail: '🌲',
      cultural_place: '🎭', lake: '🏞️', cave: '🕳️', wildlife: '🦌', heritage: '🏛️', other: '📍',
    };
    return emojiMap[category] || '📍';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: colors.warning + '30', text: colors.warning, label: '⏳ Pending Review' };
      case 'approved':
        return { bg: colors.success + '30', text: colors.success, label: '✅ Approved' };
      case 'rejected':
        return { bg: colors.danger + '30', text: colors.danger, label: '❌ Rejected' };
      default:
        return { bg: colors.textMuted + '30', text: colors.textMuted, label: status };
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <TouchableOpacity onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.title}>My Contributions</Text>
        <TouchableOpacity style={styles.addButton} onPress={onAddNew}>
          <MaterialIcons name="add" size={24} color={colors.primaryLight} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.warning }]}>{pendingCount}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>{approvedCount}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.gold }]}>{totalPoints}</Text>
            <Text style={styles.statLabel}>Points Earned</Text>
          </View>
        </View>

        {mySubmissions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>💎</Text>
            <Text style={styles.emptyTitle}>No Contributions Yet</Text>
            <Text style={styles.emptyText}>
              Discover hidden gems in Jabalpur and share them with the community!
            </Text>
            <TouchableOpacity style={styles.emptyButton} onPress={onAddNew}>
              <Text style={styles.emptyButtonText}>Submit a Hidden Gem</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.listSection}>
            <Text style={styles.sectionTitle}>Your Submissions</Text>
            {mySubmissions.map((sub) => {
              const statusBadge = getStatusBadge(sub.status);
              return (
                <View key={sub.id} style={styles.submissionCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardEmoji}>{getCategoryEmoji(sub.category)}</Text>
                      <Text style={styles.cardName} numberOfLines={1}>{sub.placeName}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusBadge.bg }]}>
                      <Text style={[styles.statusText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <Text style={styles.cardDetail}>📍 {sub.city}, {sub.state}</Text>
                    <Text style={styles.cardDetail}>📅 {formatDate(sub.submittedAt)}</Text>
                  </View>

                  {sub.status === 'approved' && (
                    <View style={styles.pointsAwarded}>
                      <Text style={styles.pointsText}>🏆 +{sub.pointsReward} Pal Points</Text>
                    </View>
                  )}

                  {sub.status === 'rejected' && sub.rejectionReason && (
                    <View style={styles.rejectionReason}>
                      <Text style={styles.rejectionLabel}>Reason:</Text>
                      <Text style={styles.rejectionText}>{sub.rejectionReason}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, paddingTop: 0 },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.text },
  addButton: { padding: spacing.xs },
  content: { flex: 1, padding: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold' },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.xs },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.text, marginBottom: spacing.md },
  listSection: { marginTop: spacing.md },
  submissionCard: { backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  cardEmoji: { fontSize: 24 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: colors.text, flex: 1 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  statusText: { fontSize: 11, fontWeight: '600' },
  cardDetails: { marginBottom: spacing.sm },
  cardDetail: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  pointsAwarded: { backgroundColor: colors.gold + '20', padding: spacing.sm, borderRadius: borderRadius.sm, alignSelf: 'flex-start' },
  pointsText: { fontSize: 13, color: colors.gold, fontWeight: '600' },
  rejectionReason: { backgroundColor: colors.danger + '10', padding: spacing.sm, borderRadius: borderRadius.sm, marginTop: spacing.sm },
  rejectionLabel: { fontSize: 11, color: colors.danger, fontWeight: '600', marginBottom: 2 },
  rejectionText: { fontSize: 12, color: colors.danger },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 64, marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginBottom: spacing.sm },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.xl },
  emptyButton: { backgroundColor: colors.primary, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: borderRadius.md },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});