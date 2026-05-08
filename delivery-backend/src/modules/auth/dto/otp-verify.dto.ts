import { IsEnum, IsString, Matches, Length } from 'class-validator';

export class OtpVerifyDto {
  @IsString()
  @Matches(/^\+972[0-9]{8,9}$/, {
    message:
      'phone must be a valid Israeli number in E.164 format e.g. +972501234567',
  })
  phone: string;

  @IsString()
  @Length(6, 6, { message: 'code must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'code must contain digits only' })
  code: string;

  @IsEnum(['CUSTOMER', 'DRIVER'], {
    message: 'role must be CUSTOMER or DRIVER',
  })
  role: 'CUSTOMER' | 'DRIVER';
}
