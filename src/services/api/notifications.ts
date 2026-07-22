import { apiClient } from './client';
import { API_CONFIG } from '../../config/api';

export interface RegisterDeviceTokenInput {
  token: string;
  platform?: 'ios' | 'android' | 'web' | 'unknown';
  appVersion?: string;
  buildNumber?: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  createdAt: string;
}

export interface NotificationsListResponse {
  notifications: InAppNotification[];
  unreadCount: number;
}

export const notificationsApi = {
  async registerToken(input: RegisterDeviceTokenInput) {
    const res = await apiClient.post(
      API_CONFIG.endpoints.notifications.registerToken,
      input,
    );
    return res.data;
  },

  async unregisterToken(token: string) {
    const res = await apiClient.delete(
      API_CONFIG.endpoints.notifications.unregisterToken,
      { token },
    );
    return res.data;
  },

  async list(page: number = 1, limit: number = 20) {
    const res = await apiClient.get<NotificationsListResponse>(
      `${API_CONFIG.endpoints.notifications.list}?page=${page}&limit=${limit}`,
    );
    return res.data;
  },

  async markRead(notificationIds: string[]) {
    const res = await apiClient.patch(
      API_CONFIG.endpoints.notifications.markRead,
      { notificationIds },
    );
    return res.data;
  },

  async markAllRead() {
    const res = await apiClient.post(
      API_CONFIG.endpoints.notifications.markAllRead,
    );
    return res.data;
  },
};
