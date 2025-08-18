import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateDocumentDto {
  @ApiProperty({ example: 'This is the content of the document' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'user_upload', required: false })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiProperty({ example: 'document.txt', required: false })
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiProperty({ example: 'text/plain', required: false })
  @IsOptional()
  @IsString()
  mimeType?: string;
}
