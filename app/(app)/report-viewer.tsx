/**
 * Report Viewer — /app/report-viewer?report_id=&pdf_url=&student_name=
 * Shared across Parent, HRT and Admin roles.
 * Uses react-native-pdf for rendering. Falls back to a WebView if pdf fails.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Paths, File as FSFile } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import { useTheme } from '../../lib/theme';
import { ThemedText } from '../../components/ui';
import { Spacing, Radius } from '../../constants/Typography';
import { Colors } from '../../constants/Colors';
import { haptics } from '../../lib/haptics';

export default function ReportViewerScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ report_id: string; pdf_url: string; student_name: string; is_draft?: string }>();
  const { pdf_url, student_name, is_draft } = params;

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const isDraft = is_draft === 'true';

  const handleShare = useCallback(async () => {
    if (!pdf_url || sharing) return;
    haptics.medium();
    setSharing(true);
    try {
      const destFile = new FSFile(Paths.cache, `report-${Date.now()}.pdf`);
      await FSFile.downloadFileAsync(pdf_url, destFile);
      await Sharing.shareAsync(destFile.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
    } catch {
      // share cancelled or failed — no user-visible error needed
    } finally {
      setSharing(false);
    }
  }, [pdf_url, sharing]);

  if (!pdf_url) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <Header student_name={student_name} isDraft={isDraft} onShare={handleShare} sharing={sharing} colors={colors} />
        <View style={styles.centerMessage}>
          <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          <ThemedText variant="h4" color="muted" style={{ marginTop: Spacing.md }}>No PDF available</ThemedText>
          <ThemedText variant="body" color="muted" style={{ textAlign: 'center', marginTop: Spacing.sm }}>
            The report PDF has not been generated yet.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <Header
        student_name={student_name}
        isDraft={isDraft}
        page={totalPages > 1 ? `${page}/${totalPages}` : undefined}
        onShare={handleShare}
        sharing={sharing}
        colors={colors}
      />

      {/* Draft watermark banner */}
      {isDraft && (
        <View style={[styles.draftBanner, { backgroundColor: Colors.semantic.errorLight }]}>
          <Ionicons name="alert-circle" size={14} color={Colors.semantic.error} />
          <ThemedText variant="caption" style={{ color: Colors.semantic.error, marginLeft: Spacing.sm, fontWeight: '700' }}>
            DRAFT — Not approved for release
          </ThemedText>
        </View>
      )}

      <View style={{ flex: 1 }}>
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator size="large" color={colors.brand.primary} />
            <ThemedText variant="bodySm" color="muted" style={{ marginTop: Spacing.md }}>Loading report…</ThemedText>
          </View>
        )}

        {error ? (
          <View style={styles.centerMessage}>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.semantic.error} />
            <ThemedText variant="body" style={{ color: Colors.semantic.error, marginTop: Spacing.md }}>
              Could not load PDF
            </ThemedText>
            <ThemedText variant="bodySm" color="muted" style={{ textAlign: 'center', marginTop: Spacing.sm }}>
              {error}
            </ThemedText>
          </View>
        ) : (
          <Pdf
            source={{ uri: pdf_url, cache: true }}
            style={styles.pdf}
            trustAllCerts={false}
            onLoadComplete={(numPages) => {
              setTotalPages(numPages);
              setLoading(false);
            }}
            onPageChanged={(p) => setPage(p)}
            onError={(err) => {
              setLoading(false);
              setError(typeof err === 'string' ? err : 'Failed to render PDF');
            }}
            enablePaging
            horizontal={false}
            spacing={0}
            fitPolicy={0}
          />
        )}
      </View>

      {/* Page indicator */}
      {totalPages > 1 && !loading && !error && (
        <View style={[styles.pageIndicator, { backgroundColor: colors.surfaceSecondary }]}>
          <ThemedText variant="caption" color="muted">
            Page {page} of {totalPages}
          </ThemedText>
        </View>
      )}
    </SafeAreaView>
  );
}

function Header({
  student_name, isDraft, page, onShare, sharing, colors,
}: {
  student_name?: string; isDraft: boolean; page?: string;
  onShare: () => void; sharing: boolean; colors: any;
}) {
  return (
    <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.headerBtn}
      >
        <Ionicons name="chevron-back" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
        <ThemedText variant="h4" numberOfLines={1}>{student_name ?? 'Report Card'}</ThemedText>
        {page && <ThemedText variant="caption" color="muted">{page}</ThemedText>}
      </View>

      <TouchableOpacity
        onPress={onShare}
        disabled={sharing}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.headerBtn, { opacity: sharing ? 0.5 : 1 }]}
      >
        {sharing
          ? <ActivityIndicator size="small" color={colors.brand.primary} />
          : <Ionicons name="share-outline" size={22} color={colors.brand.primary} />
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  pdf: { flex: 1, width: '100%' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  pageIndicator: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
