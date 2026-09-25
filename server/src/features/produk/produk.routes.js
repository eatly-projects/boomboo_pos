import { buatRuteKatalog } from '../../shared/katalog/katalog.routes.js';
import * as service from './produk.service.js';

export default buatRuteKatalog(service, { label: 'Produk' });
