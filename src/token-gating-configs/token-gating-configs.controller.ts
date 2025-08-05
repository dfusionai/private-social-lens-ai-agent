import { Body, Controller, Get, Post } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import {
  // ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { tokenGatingConfig } from './domain/token-gating-config';
import { CreateTokenGatingConfigDto } from './dto/create-token-gating-config.dto';
import { tokenGatingConfigsService } from './token-gating-configs.service';

@ApiTags('Token Gating Configs')
// @ApiBearerAuth()
// @UseGuards(AuthGuard('jwt'))
@Controller({
  path: 'token-gating-configs',
  version: '1',
})
export class tokenGatingConfigsController {
  constructor(
    private readonly tokenGatingConfigsService: tokenGatingConfigsService,
  ) {}

  @Post()
  @ApiCreatedResponse({
    type: tokenGatingConfig,
  })
  create(@Body() createTokenGatingConfigDto: CreateTokenGatingConfigDto) {
    return this.tokenGatingConfigsService.create(createTokenGatingConfigDto);
  }

  @Get('latest')
  @ApiOkResponse({
    type: tokenGatingConfig,
  })
  getLatestConfig() {
    return this.tokenGatingConfigsService.getLatestConfig();
  }
}
