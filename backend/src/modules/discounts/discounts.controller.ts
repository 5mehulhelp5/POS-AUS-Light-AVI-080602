import {
  Controller,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DiscountsService } from './discounts.service';
import { ValidateDiscountDto } from './dto/validate-discount.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('discounts')
@Controller('discounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DiscountsController {
  constructor(private readonly discountsService: DiscountsService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate discount before applying' })
  async validateDiscount(
    @Body() dto: ValidateDiscountDto,
    @CurrentUser() user: any,
  ) {
    const userRole = {
      id: user.role.id,
      name: user.role.name,
      maxDiscountPercent: parseFloat(user.role.maxDiscountPercent),
      canStackDiscounts: user.role.canStackDiscounts,
    };

    const result = this.discountsService.validateAndCalculate(dto, userRole);

    // Log any rejected discount attempts
    if (result.auditEntries.some((e) => e.wasRejected)) {
      await this.discountsService.logDiscountAudit(
        null,
        user.id,
        user.role.name,
        result.auditEntries.filter((e) => e.wasRejected),
      );
    }

    return {
      success: true,
      data: {
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        calculatedTotals: result.calculatedTotals,
        userLimits: {
          maxDiscountPercent: userRole.maxDiscountPercent,
          canStackDiscounts: userRole.canStackDiscounts,
        },
      },
    };
  }
}
