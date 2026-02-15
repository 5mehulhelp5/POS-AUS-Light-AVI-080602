import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface CompetitorPrice {
  price: number | null;
  url: string | null;
  source: string;
  error?: string;
}

@Injectable()
export class CompetitorService {
  private readonly logger = new Logger(CompetitorService.name);

  // Simple in-memory cache: productName -> { result, timestamp }
  private cache = new Map<string, { result: CompetitorPrice; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour

  async getCompetitorPrice(productName: string): Promise<CompetitorPrice> {
    // Check cache first
    const cacheKey = productName.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    try {
      // Step 1: Search Google for the product on the competitor site
      const productUrl = await this.searchGoogle(productName);
      if (!productUrl) {
        const result: CompetitorPrice = {
          price: null,
          url: null,
          source: 'onlinelighting.com.au',
          error: 'Product not found on competitor site',
        };
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }

      // Step 2: Scrape the product page for price
      const price = await this.scrapePrice(productUrl);
      const result: CompetitorPrice = {
        price,
        url: productUrl,
        source: 'onlinelighting.com.au',
        error: price === null ? 'Could not extract price' : undefined,
      };

      this.cache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      this.logger.error(`Failed to get competitor price for "${productName}": ${error.message}`);
      return {
        price: null,
        url: null,
        source: 'onlinelighting.com.au',
        error: 'Failed to fetch competitor price',
      };
    }
  }

  private async searchGoogle(productName: string): Promise<string | null> {
    const query = `${productName} site:onlinelighting.com.au`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=3`;

    try {
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(data);

      // Google search results contain links in <a> tags
      // Look for links to onlinelighting.com.au
      let productUrl: string | null = null;

      $('a[href]').each((_, el) => {
        if (productUrl) return;
        const href = $(el).attr('href') || '';

        // Google wraps URLs in /url?q=<actual-url>&...
        const match = href.match(/\/url\?q=(https?:\/\/[^&]+onlinelighting\.com\.au[^&]*)/);
        if (match) {
          const decoded = decodeURIComponent(match[1]);
          // Only accept product pages (ending in .html)
          if (decoded.includes('.html')) {
            productUrl = decoded;
          }
        }

        // Direct links
        if (
          href.includes('onlinelighting.com.au') &&
          href.includes('.html') &&
          href.startsWith('http')
        ) {
          productUrl = href;
        }
      });

      return productUrl;
    } catch (error) {
      this.logger.warn(`Google search failed: ${error.message}`);
      return null;
    }
  }

  private async scrapePrice(productUrl: string): Promise<number | null> {
    try {
      const { data } = await axios.get(productUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-AU,en;q=0.9',
        },
        timeout: 10000,
      });

      const $ = cheerio.load(data);

      // Try multiple selectors for price extraction
      const priceSelectors = [
        '.price-wrapper .price',
        '.product-info-price .price',
        '.special-price .price',
        '.normal-price .price',
        'span.price',
        '[data-price-amount]',
        '.price-box .price',
        'meta[property="product:price:amount"]',
      ];

      for (const selector of priceSelectors) {
        const el = $(selector).first();
        if (el.length) {
          // Check for meta tag (content attribute)
          if (selector.includes('meta')) {
            const content = el.attr('content');
            if (content) {
              const price = parseFloat(content);
              if (!isNaN(price) && price > 0) return price;
            }
            continue;
          }

          // Check data attribute
          const dataPrice = el.attr('data-price-amount');
          if (dataPrice) {
            const price = parseFloat(dataPrice);
            if (!isNaN(price) && price > 0) return price;
          }

          // Parse text content like "AU$2,199.00" or "$199.00"
          const text = el.text().trim();
          const priceMatch = text.match(/\$?\s?([\d,]+\.?\d*)/);
          if (priceMatch) {
            const price = parseFloat(priceMatch[1].replace(/,/g, ''));
            if (!isNaN(price) && price > 0) return price;
          }
        }
      }

      // Fallback: search for JSON-LD structured data
      let ldPrice: number | null = null;
      $('script[type="application/ld+json"]').each((_, el) => {
        if (ldPrice) return;
        try {
          const json = JSON.parse($(el).html() || '');
          if (json['@type'] === 'Product' && json.offers) {
            const offers = Array.isArray(json.offers) ? json.offers[0] : json.offers;
            if (offers.price) {
              ldPrice = parseFloat(offers.price);
            }
          }
        } catch {
          // ignore parse errors
        }
      });

      return ldPrice;
    } catch (error) {
      this.logger.warn(`Failed to scrape price from ${productUrl}: ${error.message}`);
      return null;
    }
  }
}
