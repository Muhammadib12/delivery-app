import { IsString, Matches } from 'class-validator';

export class OtpRequestDto {
  @IsString()
  @Matches(/^\+972[0-9]{8,9}$/, {
    message:
      'phone must be a valid Israeli number in E.164 format e.g. +972501234567',
  })
  phone: string;
}
