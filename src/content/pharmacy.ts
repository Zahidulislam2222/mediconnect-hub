import { z } from 'zod';
import source from './pharmacy.json';
z.record(z.string().trim().min(1)).parse(source);
export default source;
