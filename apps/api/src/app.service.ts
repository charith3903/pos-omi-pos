import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getRoot() {
    return { name: 'OmniPOS API', version: '0.0.1' };
  }
}
