import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalrusService } from './interfaces/walrus.interface';
import { MockWalrusService } from './providers/mock-walrus.service';

export enum WalrusProvider {
  MOCK = 'mock',
  PRODUCTION = 'production',
}

@Injectable()
export class WalrusFactoryService {
  private readonly logger = new Logger(WalrusFactoryService.name);
  private walrusService: WalrusService;

  constructor(
    private readonly configService: ConfigService,
    private readonly mockWalrusService: MockWalrusService,
  ) {
    this.initializeWalrusService();
  }

  private initializeWalrusService(): void {
    const provider = this.configService.get<string>(
      'WALRUS_PROVIDER',
      WalrusProvider.MOCK,
      { infer: true },
    );

    switch (provider) {
      case WalrusProvider.MOCK:
        this.walrusService = this.mockWalrusService;
        this.logger.log('Initialized Mock Walrus service');
        break;
      case WalrusProvider.PRODUCTION:
        // TODO: Implement production Walrus service
        throw new Error('Production Walrus service not implemented yet');
      default:
        this.logger.warn(
          `Unknown Walrus provider: ${provider}, falling back to mock`,
        );
        this.walrusService = this.mockWalrusService;
    }
  }

  getWalrusService(): WalrusService {
    return this.walrusService;
  }
}
