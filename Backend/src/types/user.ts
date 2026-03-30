export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber: string;
  profilePhoto?: string;
  isVerified: boolean;
}
