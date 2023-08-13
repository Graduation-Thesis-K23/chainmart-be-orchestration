import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersController } from './orders.controller';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'BATCH_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'batch-orchestration',
              brokers: [
                `${configService.get('KAFKA_HOST')}:${configService.get(
                  'KAFKA_PORT',
                )}`,
              ],
            },
            consumer: {
              groupId: 'batch-consumer-orchestration',
            },
          },
        }),
      },
      {
        name: 'ORDER_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'order-orchestration',
              brokers: [
                `${configService.get('KAFKA_HOST')}:${configService.get(
                  'KAFKA_PORT',
                )}`,
              ],
            },
            consumer: {
              groupId: 'order-consumer-orchestration',
            },
          },
        }),
      },
      {
        name: 'NOTIFICATION_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: async (configService) => {
          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: 'notification-orchestration',
                brokers: [
                  `${configService.get('KAFKA_HOST')}:${configService.get(
                    'KAFKA_PORT',
                  )}`,
                ],
              },
              consumer: {
                groupId: 'notification-consumer-orchestration',
              },
            },
          };
        },
      },
    ]),
  ],
  controllers: [OrdersController],
})
export class OrdersModule {}
