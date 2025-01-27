export interface Webhook {
  id: string;
  userId: string;
  ip: string;
  city: string;
  region: string;
  country: string;
  createdAt: string;
  payload: Record<string, any>;
}