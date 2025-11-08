import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { SubmissionConfig } from '../config/submission-config.type';
import { AllConfigType } from '../../config/config.type';

// Minimal ABI for token contract - only balanceOf function
const TOKEN_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

// Minimal ABI for staking contract - only getActiveStakes function
const STAKING_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'getActiveStakes',
    outputs: [
      {
        components: [
          {
            internalType: 'uint256',
            name: 'amount',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'startTime',
            type: 'uint256',
          },
          {
            internalType: 'uint256',
            name: 'duration',
            type: 'uint256',
          },
          {
            internalType: 'bool',
            name: 'hasWithdrawn',
            type: 'bool',
          },
          {
            internalType: 'uint256',
            name: 'withdrawalTime',
            type: 'uint256',
          },
        ],
        internalType: 'struct Staking.Stake[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

export interface Stake {
  amount: number;
  startTime: number;
  duration: number;
  hasWithdrawn: boolean;
  withdrawalTime: number;
}

@Injectable()
export class VanaBlockchainService {
  private readonly logger = new Logger(VanaBlockchainService.name);
  private rpcProvider: ethers.JsonRpcProvider | null = null;
  private tokenContract: ethers.Contract | null = null;
  private stakingContract: ethers.Contract | null = null;

  constructor(private readonly configService: ConfigService<AllConfigType>) {
    this.initializeContracts();
  }

  private initializeContracts() {
    const submissionConfig = this.configService.get<SubmissionConfig>(
      'submission',
      { infer: true },
    );

    if (!submissionConfig.blockchainRpcUrl) {
      this.logger.warn(
        'Blockchain RPC URL not configured. Token gating checks will fail.',
      );
      return;
    }

    try {
      this.rpcProvider = new ethers.JsonRpcProvider(
        submissionConfig.blockchainRpcUrl,
      );

      if (submissionConfig.tokenContractAddress) {
        this.tokenContract = new ethers.Contract(
          submissionConfig.tokenContractAddress,
          TOKEN_ABI,
          this.rpcProvider,
        );
      }

      if (submissionConfig.stakingContractAddress) {
        this.stakingContract = new ethers.Contract(
          submissionConfig.stakingContractAddress,
          STAKING_ABI,
          this.rpcProvider,
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize blockchain contracts:', error);
    }
  }

  /**
   * Get token balance for a wallet address
   */
  async getTokenBalance(walletAddress: string): Promise<number> {
    if (!this.tokenContract) {
      throw new Error('Token contract not initialized');
    }

    try {
      const balance = await this.tokenContract['balanceOf'](walletAddress);
      const formattedBalance = ethers.formatUnits(balance, 18);
      return Number(formattedBalance);
    } catch (error) {
      this.logger.error(
        `Failed to get token balance for ${walletAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get active stakes for a wallet address
   */
  async getActiveStakes(walletAddress: string): Promise<Stake[]> {
    if (!this.stakingContract) {
      throw new Error('Staking contract not initialized');
    }

    try {
      const blockchainStakes =
        await this.stakingContract['getActiveStakes'](walletAddress);
      const stakes: Stake[] = [];

      blockchainStakes.forEach((stake: any) => {
        const formattedStake: Stake = {
          amount: Number(ethers.formatUnits(stake.amount, 18)),
          startTime: Number(ethers.formatUnits(stake.startTime, 0)),
          duration: Number(ethers.formatUnits(stake.duration, 0)),
          hasWithdrawn: stake.hasWithdrawn,
          withdrawalTime: Number(ethers.formatUnits(stake.withdrawalTime, 0)),
        };
        stakes.push(formattedStake);
      });

      return stakes;
    } catch (error) {
      this.logger.error(
        `Failed to get active stakes for ${walletAddress}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get total staked amount for a wallet address
   */
  async getTotalStaked(walletAddress: string): Promise<number> {
    const stakes = await this.getActiveStakes(walletAddress);
    const totalStakeAmount = stakes.reduce(
      (sum, stake) => sum + stake.amount,
      0,
    );
    return totalStakeAmount;
  }

  /**
   * Check if wallet meets token gating requirements
   * Returns true if wallet has either:
   * - At least stakeThreshold tokens staked OR
   * - At least balanceThreshold tokens in wallet
   */
  async checkTokenGating(
    walletAddress: string,
    stakeThreshold: number,
    balanceThreshold: number,
  ): Promise<boolean> {
    try {
      const [totalStaked, balance] = await Promise.all([
        this.getTotalStaked(walletAddress).catch(() => 0),
        this.getTokenBalance(walletAddress).catch(() => 0),
      ]);

      // Either 500 $VFSN staked OR 2500 $VFSN in your wallet
      const isAllowed =
        totalStaked >= stakeThreshold || balance >= balanceThreshold;

      this.logger.debug(
        `Token gating check for ${walletAddress}: stake=${totalStaked} (threshold=${stakeThreshold}), balance=${balance} (threshold=${balanceThreshold}), allowed=${isAllowed}`,
      );

      return isAllowed;
    } catch (error) {
      this.logger.error(
        `Failed to check token gating for ${walletAddress}:`,
        error,
      );
      // On error, default to not allowed (epochs = 1)
      return false;
    }
  }
}
