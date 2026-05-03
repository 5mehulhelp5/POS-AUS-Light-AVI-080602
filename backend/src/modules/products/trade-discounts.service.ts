import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from './entities/product.entity';

// Mirrors the three Magento cart price rules Sally maintains for trade
// customers (rule IDs 88, 89, 92). Hardcoded here so the POS can apply
// the same discounts when a quote is built — no Magento round-trip per
// cart change. If Sally adds/edits trade rules in Magento, this list
// has to be edited too.
//
// Resolution rule per line:
//   - Pick the SINGLE highest matching auto discount (rules don't stack
//     with each other — matches Magento's stop_rules_processing default
//     for these rules)
//   - The cashier's manual line discount overrides the auto one ONLY if
//     it's higher; otherwise the auto value wins. So the trade customer
//     always gets at least their entitled discount.
type TradeRule = {
  id: number;
  label: string;
  percent: number;
  match: (ctx: { product: Product; categoryIds: Set<number> }) => boolean;
};

const SMART_HOME_ROOT_CATEGORY_ID = 24; // pos.categories.id, includes descendants
const LED_ALU_PROFILE_CATEGORY_ID = 92; // pos.categories.id (no children today)

const RULES: TradeRule[] = [
  {
    id: 88,
    label: '10% off Smart Home (TRADE)',
    percent: 10,
    match: ({ categoryIds }) => categoryIds.has(SMART_HOME_ROOT_CATEGORY_ID),
  },
  {
    id: 89,
    label: '10% off LED Aluminium Profile (TRADE)',
    percent: 10,
    match: ({ categoryIds }) => categoryIds.has(LED_ALU_PROFILE_CATEGORY_ID),
  },
  {
    id: 92,
    label: '20% off all lighting minus Eglo (TRADE)',
    percent: 20,
    // "all lighting" is the entire catalogue minus the Eglo brand. Eglo
    // products have no brand attribute synced so we identify them by
    // the name starting with "Eglo " (matches all 663 hits in prod).
    match: ({ product }) => !/^eglo\b/i.test(product.name),
  },
];

@Injectable()
export class TradeDiscountsService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  // Cache: smart-home root id → set of itself + all descendant ids.
  // Categories rarely change so we just memoise the first lookup; a
  // fresh sync that adds children needs a backend restart to pick them
  // up (acceptable trade-off for this code path).
  private subtreeCache = new Map<number, Set<number>>();

  private async getSubtreeIds(rootId: number): Promise<Set<number>> {
    const cached = this.subtreeCache.get(rootId);
    if (cached) return cached;
    const all = await this.categoryRepository.find({
      select: ['id', 'parentId'],
    });
    const childrenByParent = new Map<number, number[]>();
    for (const c of all) {
      if (c.parentId == null) continue;
      if (!childrenByParent.has(c.parentId)) {
        childrenByParent.set(c.parentId, []);
      }
      childrenByParent.get(c.parentId)!.push(c.id);
    }
    const result = new Set<number>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
      const id = queue.shift()!;
      const kids = childrenByParent.get(id) || [];
      for (const k of kids) {
        if (!result.has(k)) {
          result.add(k);
          queue.push(k);
        }
      }
    }
    this.subtreeCache.set(rootId, result);
    return result;
  }

  // Returns the percent (0-100) of the best-matching trade rule for
  // this product, plus a label so the caller can show it to the cashier
  // / log it. Returns 0 / null when no rule matches.
  async getAutoDiscount(
    product: Product,
  ): Promise<{ percent: number; label: string | null }> {
    const smartHomeIds = await this.getSubtreeIds(SMART_HOME_ROOT_CATEGORY_ID);

    // Expand the matched rules' category checks against the product's
    // category set. We treat smart-home as "in the subtree of 24".
    const productCategoryIds = new Set<number>();
    for (const c of product.categories || []) {
      productCategoryIds.add(c.id);
      // smart-home rule wants to match descendants too; do that by
      // adding the root id when ANY of the product's categories falls
      // inside the precomputed subtree.
      if (smartHomeIds.has(c.id)) {
        productCategoryIds.add(SMART_HOME_ROOT_CATEGORY_ID);
      }
    }

    let best: { percent: number; label: string } | null = null;
    for (const rule of RULES) {
      if (!rule.match({ product, categoryIds: productCategoryIds })) continue;
      if (!best || rule.percent > best.percent) {
        best = { percent: rule.percent, label: rule.label };
      }
    }
    return best ? best : { percent: 0, label: null };
  }
}
