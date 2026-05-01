import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, Alert, Linking } from 'react-native';
import { useTheme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import {
  ThemedText, Button, Card, Badge,
  EmptyState, ErrorState, SectionHeader,
} from '../../../components/ui';
import { Spacing } from '../../../constants/Typography';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Ionicons } from '@expo/vector-icons';
import { useBackupDestination, useBackupLogs, useTriggerBackup } from '../../../hooks/useBackup';

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';


export default function BackupSettingsScreen() {
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const schoolId = user?.schoolId ?? '';
  const staffId = user?.staffId ?? null;

  const { data: destination, isLoading, isError, refetch } = useBackupDestination(schoolId);
  const { data: logs } = useBackupLogs(schoolId);
  const triggerBackup = useTriggerBackup(schoolId);
  const [triggering, setTriggering] = useState(false);

  const handleConnectGoogle = () => {
    // In real implementation, this would open OAuth flow
    // For now, show instructions
    Alert.alert(
      'Connect Google Drive',
      'To enable backups, you need to:\n\n1. Create a Google Cloud project\n2. Enable Google Drive API\n3. Configure OAuth credentials\n4. Add your refresh token to Supabase secrets\n\nContact support for setup assistance.',
      [{ text: 'OK' }]
    );
  };

  const handleTriggerBackup = async () => {
    if (!destination) {
      Alert.alert('Error', 'Google Drive not connected');
      return;
    }
    setTriggering(true);
    try {
      const result = await triggerBackup.mutateAsync({ triggeredBy: staffId! });
      if (result.success) {
        Alert.alert('Backup Complete', `File: ${result.filename}\nRecords: ${result.total_records}`);
      } else {
        Alert.alert('Backup Failed', 'Unknown error');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setTriggering(false);
  };

  if (isError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <ErrorState title="Could not load settings" description="Try again." onRetry={refetch} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Backup Settings" showBack />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Connection Status */}
        <Card style={{ margin: Spacing.screen, padding: Spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md }}>
            <Ionicons name="logo-google" size={24} color={destination ? '#4285F4' : colors.textMuted} />
            <ThemedText variant="h4" style={{ marginLeft: Spacing.md }}>
              Google Drive
            </ThemedText>
          </View>

          {isLoading ? (
            <View style={{ gap: 8, marginTop: Spacing.md }}>
              <View style={{ height: 14, width: '50%', backgroundColor: colors.surfaceSecondary, borderRadius: 4 }} />
            </View>
          ) : destination ? (
            <>
              <Badge label="Connected" preset="success" style={{ alignSelf: 'flex-start' }} />
              <ThemedText variant="caption" color="muted" style={{ marginTop: Spacing.sm }}>
                Folder: {destination.folder_name ?? 'eScholr Backups'}
              </ThemedText>
              {destination.last_backup_at && (
                <ThemedText variant="caption" color="muted">
                  Last backup: {new Date(destination.last_backup_at).toLocaleString()}
                </ThemedText>
              )}
              <Button
                label={triggering ? 'Backing up...' : 'Backup Now'}
                onPress={handleTriggerBackup}
                disabled={triggering}
                style={{ marginTop: Spacing.lg }}
              />
            </>
          ) : (
            <>
              <Badge label="Not Connected" preset="neutral" style={{ alignSelf: 'flex-start' }} />
              <ThemedText variant="caption" color="muted" style={{ marginTop: Spacing.sm, marginBottom: Spacing.lg }}>
                Connect Google Drive to enable automatic backups
              </ThemedText>
              <Button label="Connect Google Drive" onPress={handleConnectGoogle} />
            </>
          )}
        </Card>

        {/* Backup History */}
        <SectionHeader title="Backup History" />
        {logs?.length === 0 ? (
          <EmptyState title="No backups yet" description="Backup history appears here." icon="cloud-upload-outline" />
        ) : (
          logs?.map((log: any) => (
            <Card key={log.id} style={{ marginHorizontal: Spacing.screen, marginBottom: Spacing.sm, padding: Spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <ThemedText style={{ fontWeight: '600' }}>{log.file_name}</ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {new Date(log.started_at).toLocaleString()}
                  </ThemedText>
                  <ThemedText variant="caption" color="muted">
                    {log.total_records?.toLocaleString?.() ?? log.total_records} records
                  </ThemedText>
                </View>
                <Badge
                  label={log.status}
                  preset={log.status === 'success' ? 'success' : 'error'}
                />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
