import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InquiriesService } from './inquiries.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InquiryStatus, InquiryType } from './entities';

@ApiTags('inquiries')
@Controller('inquiries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InquiriesController {
  constructor(private readonly inquiriesService: InquiriesService) {}

  @Get()
  @ApiOperation({ summary: 'List inquiries' })
  async findAll(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('customerId') customerId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const { inquiries, total } = await this.inquiriesService.findAll({
      status: status as InquiryStatus,
      type: type as InquiryType,
      customerId,
      page,
      limit,
    });

    return {
      success: true,
      data: {
        inquiries: inquiries.map((i) => ({
          id: i.id,
          type: i.type,
          status: i.status,
          subject: i.subject,
          description: i.description,
          contactName: i.contactName,
          contactPhone: i.contactPhone,
          contactEmail: i.contactEmail,
          followUpDate: i.followUpDate,
          customer: i.customer
            ? {
                id: i.customer.id,
                firstName: i.customer.firstName,
                lastName: i.customer.lastName,
              }
            : null,
          user: {
            id: i.user.id,
            firstName: i.user.firstName,
            lastName: i.user.lastName,
          },
          createdAt: i.createdAt,
        })),
        pagination: {
          page: page || 1,
          limit: limit || 20,
          total,
          totalPages: Math.ceil(total / (limit || 20)),
        },
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get inquiry by ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const inquiry = await this.inquiriesService.findById(id);
    if (!inquiry) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Inquiry not found' },
      };
    }

    return {
      success: true,
      data: { inquiry },
    };
  }
}
