// Auth Module - Domain Transfer Object (DTO)

export interface LoginDTO {
  identifier: string; // email or phone number
  password: string;
}

export interface SignupDTO {
  email?: string;
  password: string;
  name: string;
  phoneNumber: string;
  dateOfBirth?: string; // YYYY-MM-DD; required for a customer signing up (checked in AuthService.signup)
  emergencyName?: string; // emergency contact: required for a customer signing up (utils/emergency.ts)
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export interface RefreshTokenDTO {
  refreshToken: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: {
    id: string;
    email: string | null;
    name: string;
    phoneNumber: string;
    role: string;
    avatar?: string;
    freeMatchesAvailable?: number;
    isVerified?: boolean;
    mustChangePassword?: boolean; // a friend's first sign-in with the shared password: the app asks for a new one
  };
}

export interface MeResponse {
  id: string;
  email: string | null;
  name: string;
  phoneNumber: string;
  role: string;
  avatar?: string;
  freeMatchesAvailable?: number;
  isVerified?: boolean;
  loginCount?: number;
  hasEmergencyContact?: boolean; // false: the app reminds the customer to add one
  mustChangePassword?: boolean;
}

export interface UpdateMeDTO {
  name?: string;
  avatar?: string; // base64 data URL or remote URL
}

export interface ForgotPasswordDTO {
  phoneNumber: string;
}

export interface ResetPasswordDTO {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}

export interface ChangePasswordDTO {
  currentPassword?: string;
  newPassword: string;
}
