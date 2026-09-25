import { buatRuteKatalog } from '../../shared/katalog/katalog.routes.js';
import * as service from './menu.service.js';

export default buatRuteKatalog(service, { label: 'Menu' });
