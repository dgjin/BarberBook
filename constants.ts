import { Barber, SystemSettings } from './types';

export const MOCK_BARBERS: Barber[] = [
  {
    id: 'b1',
    name: 'Alex "The Fade" Miller',
    specialty: '渐变 & 现代剪裁',
    avatarUrl: 'https://picsum.photos/100/100?random=1',
    bio: '擅长皮肤渐变和纹理处理。'
  },
  {
    id: 'b2',
    name: 'Sarah Scissors',
    specialty: '长发 & 造型',
    avatarUrl: 'https://picsum.photos/100/100?random=2',
    bio: '拥有10年复杂层次剪裁经验。'
  },
  {
    id: 'b3',
    name: 'Davide Classic',
    specialty: '胡须 & 经典剪裁',
    avatarUrl: 'https://picsum.photos/100/100?random=3',
    bio: '融合现代风格的老派技术。'
  }
];

export const DEFAULT_SETTINGS: SystemSettings = {
  maxSlotsPerBarberPerDay: 10,
  openingTime: '08:00',
  closingTime: '17:00',
  slotDurationMinutes: 45
};

export const MOCK_USER_ID = 'user_12345';
export const MOCK_USER_NAME = '当前用户';