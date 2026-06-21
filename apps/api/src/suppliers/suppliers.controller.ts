import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  getSuppliers(@Req() req, @Query('search') search?: string) {
    return this.suppliersService.getSuppliers(req.user.tenantId, search);
  }

  @Post()
  createSupplier(@Req() req, @Body() body) {
    return this.suppliersService.createSupplier(req.user.tenantId, body);
  }

  @Put(':id')
  updateSupplier(@Req() req, @Param('id') id: string, @Body() body) {
    return this.suppliersService.updateSupplier(req.user.tenantId, id, body);
  }

  @Delete(':id')
  deleteSupplier(@Req() req, @Param('id') id: string) {
    return this.suppliersService.deleteSupplier(req.user.tenantId, id);
  }
}
