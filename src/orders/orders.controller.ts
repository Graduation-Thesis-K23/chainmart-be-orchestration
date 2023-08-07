import { Controller, Inject, OnModuleInit, UseFilters } from '@nestjs/common';
import { ClientKafka, EventPattern } from '@nestjs/microservices';
import { lastValueFrom, timeout } from 'rxjs';

import { ExceptionFilter } from 'src/filters/rpc-exception.filter';

@Controller()
@UseFilters(new ExceptionFilter())
export class OrdersController implements OnModuleInit {
  constructor(
    @Inject('BATCH_SERVICE')
    private readonly batchClient: ClientKafka,

    @Inject('ORDER_SERVICE')
    private readonly orderClient: ClientKafka,
  ) {}

  async onModuleInit() {
    const topics = ['package', 'checkavailable'];
    topics.forEach((topic) => {
      this.batchClient.subscribeToResponseOf(`batches.${topic}`);
    });
    await this.batchClient.connect();
  }

  @EventPattern('orchestration.orders.created')
  async processOrder(order: any) {
    console.log('orchestration.orders.created', order);
    try {
      if (order.payment === 'CASH') {
        const $batchResponse = this.batchClient
          .send('batches.checkavailable', order.order_details)
          .pipe(timeout(60000));
        const result = await lastValueFrom($batchResponse);
        console.log('result', result);
        return;
      }
      const $batchResponse = this.batchClient
        .send('batches.package', order.order_details)
        .pipe(timeout(60000));
      const batchResponse = await lastValueFrom($batchResponse);
      // batches.order_status === 'Approved'
      // batches.branch_id === branch should be same as order.branch_id
      console.log('batchResponse', batchResponse);

      if (batchResponse.order_status === 'Approved') {
        // this.orderClient.emit('orders.packaged', order.id);
        this.orderClient.emit('orders.approveorderbyemployee', {
          phone: 'BOT',
          order_id: order.id,
          branch_id: batchResponse.branch_id,
        });
      }
    } catch (error) {
      console.error(error);
      this.orderClient.emit('orders.cancelled', order.id);
    }
  }
}
