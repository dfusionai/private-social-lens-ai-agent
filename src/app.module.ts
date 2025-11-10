import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { FilesModule } from './files/files.module';
import { AuthModule } from './auth/auth.module';
import databaseConfig from './database/config/database.config';
import authConfig from './auth/config/auth.config';
import appConfig from './config/app.config';
import mailConfig from './mail/config/mail.config';
import fileConfig from './files/config/file.config';
import azureOpenaiConfig from './model-api/config/azure-openai.config';
import openaiConfig from './model-api/config/openai.config';
import claudeConfig from './model-api/config/claude.config';
import ollamaConfig from './model-api/config/ollama.config';
import jobConfig from './jobs/config/job.config';
import path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeaderResolver, I18nModule } from 'nestjs-i18n';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { MailModule } from './mail/mail.module';
import { HomeModule } from './home/home.module';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AllConfigType } from './config/config.type';
import { SessionModule } from './session/session.module';
import { MailerModule } from './mailer/mailer.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { JobsModule } from './jobs/jobs.module';
import { SubmissionsModule } from './submissions/submissions.module';
import submissionConfig from './submissions/config/submission.config';

import { tokenGatingConfigsModule } from './token-gating-configs/token-gating-configs.module';

@Module({
  imports: [
    tokenGatingConfigsModule,
    MessagesModule,
    ConversationsModule,
    JobsModule,
    SubmissionsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        mailConfig,
        fileConfig,
        azureOpenaiConfig,
        openaiConfig,
        claudeConfig,
        ollamaConfig,
        jobConfig,
        submissionConfig,
      ],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => {
        // In development, use source directory; in production, use dist directory
        const isDevelopment =
          configService.get('app.nodeEnv', { infer: true }) === 'development';
        let i18nPath: string;
        if (isDevelopment) {
          i18nPath = path.join(process.cwd(), 'src', 'i18n');
        } else {
          // In production, handle both dist/ and dist/src/ structures
          // If __dirname is dist/src, go up one level to dist/, then to i18n
          // If __dirname is dist, go directly to i18n
          if (__dirname.includes(path.join('dist', 'src'))) {
            i18nPath = path.join(__dirname, '..', 'i18n');
          } else {
            i18nPath = path.join(__dirname, 'i18n');
          }
        }

        return {
          fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
            infer: true,
          }),
          loaderOptions: {
            path: i18nPath,
            watch: configService.get('app.i18nWatchFiles', { infer: true }),
          },
        };
      },
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
  ],
})
export class AppModule {}
