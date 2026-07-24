import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

/** Collapse doubled letters (nidaan → nidan) for soft spelling matches. */
function collapseRepeats(value: string): string {
  return value.toLowerCase().replace(/([a-z])\1+/g, '$1');
}

async function searchPlacesFuzzy(opts: {
  q: string;
  qCollapsed: string;
  fuzzyMin: number;
  limit: number;
  hiddenGem: boolean;
}) {
  const { q, qCollapsed, fuzzyMin, limit, hiddenGem } = opts;
  const sourceClause = hiddenGem
    ? `source = 'HIDDEN_GEM'`
    : `source != 'HIDDEN_GEM'`;

  try {
    return await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, slug, short_description as "shortDescription", thumbnail, category, city, state, rating, review_count as "reviewCount",
             GREATEST(
               COALESCE(ts_rank(search_vector, plainto_tsquery('english', $1)), 0),
               COALESCE(word_similarity($1, name), 0),
               COALESCE(similarity(lower(name), lower($1)), 0)
             ) AS rank
      FROM places
      WHERE status = 'APPROVED'
        AND ${sourceClause}
        AND category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
        AND (
          search_vector @@ plainto_tsquery('english', $1)
          OR city ILIKE '%' || $1 || '%'
          OR state ILIKE '%' || $1 || '%'
          OR name ILIKE '%' || $1 || '%'
          OR regexp_replace(lower(name), '([a-z])\\1+', '\\1', 'g') LIKE '%' || $2 || '%'
          OR word_similarity($1, name) >= $3
          OR similarity(lower(name), lower($1)) >= $3
        )
      ORDER BY rank DESC NULLS LAST, name ASC
      LIMIT $4
      `,
      q,
      qCollapsed,
      fuzzyMin,
      limit,
    );
  } catch {
    // pg_trgm not available — still match soft spellings via collapsed letters
    return prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, name, slug, short_description as "shortDescription", thumbnail, category, city, state, rating, review_count as "reviewCount",
             ts_rank(search_vector, plainto_tsquery('english', $1)) AS rank
      FROM places
      WHERE status = 'APPROVED'
        AND ${sourceClause}
        AND category::text NOT IN ('SHOPPING', 'RESTAURANT', 'HOTEL')
        AND (
          search_vector @@ plainto_tsquery('english', $1)
          OR city ILIKE '%' || $1 || '%'
          OR state ILIKE '%' || $1 || '%'
          OR name ILIKE '%' || $1 || '%'
          OR regexp_replace(lower(name), '([a-z])\\1+', '\\1', 'g') LIKE '%' || $2 || '%'
        )
      ORDER BY rank DESC NULLS LAST, name ASC
      LIMIT $3
      `,
      q,
      qCollapsed,
      limit,
    );
  }
}

export const searchService = {
  async universalSearch(userId: string | undefined, query: any) {
    const q = query.q?.trim();
    if (!q) {
      return {
        places: [],
        vendors: [],
        reels: [],
        creators: [],
        events: [],
        offers: [],
      };
    }

    const limit = parseInt(query.limit || '10');
    const qCollapsed = collapseRepeats(q);
    // Fuzzy threshold: allow near-misses like nidaan ↔ Nidan without matching unrelated names
    const fuzzyMin = q.length <= 4 ? 0.45 : 0.32;

    // Parallel searches
    const [
      placesRaw,
      hiddenGemsRaw,
      reelsRaw,
      vendors,
      creators,
      events,
      offers,
    ] = await Promise.all([
      searchPlacesFuzzy({ q, qCollapsed, fuzzyMin, limit, hiddenGem: false }),
      searchPlacesFuzzy({ q, qCollapsed, fuzzyMin, limit, hiddenGem: true }),

      // Reels
      (async () => {
        try {
          return await prisma.$queryRaw<any[]>`
            SELECT id, video_url as "videoUrl", thumbnail, title, description, views, likes, category, created_at as "createdAt",
                   ts_rank(search_vector, plainto_tsquery('english', ${q})) AS rank
            FROM reels
            WHERE search_vector @@ plainto_tsquery('english', ${q})
               OR title ILIKE ${'%' + q + '%'}
               OR regexp_replace(lower(COALESCE(title, '')), '([a-z])\\1+', '\\1', 'g')
                    LIKE ${'%' + qCollapsed + '%'}
            ORDER BY rank DESC NULLS LAST
            LIMIT ${limit}
          `;
        } catch {
          return [] as any[];
        }
      })(),

      // Vendors
      (async () => {
        try {
          return await prisma.$queryRawUnsafe<any[]>(
            `
            SELECT id, business_name as "businessName", business_type as "businessType", city, image_url as "imageUrl", description
            FROM vendors
            WHERE status = 'APPROVED'
              AND (
                business_name ILIKE '%' || $1 || '%'
                OR description ILIKE '%' || $1 || '%'
                OR city ILIKE '%' || $1 || '%'
                OR word_similarity($1, business_name) >= $3
                OR regexp_replace(lower(business_name), '([a-z])\\1+', '\\1', 'g') LIKE '%' || $2 || '%'
              )
            ORDER BY word_similarity($1, business_name) DESC NULLS LAST, business_name ASC
            LIMIT $4
            `,
            q,
            qCollapsed,
            fuzzyMin,
            limit,
          );
        } catch {
          return prisma.vendor.findMany({
            where: {
              status: 'APPROVED',
              OR: [
                { businessName: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { city: { contains: q, mode: 'insensitive' } },
              ],
            },
            select: { id: true, businessName: true, businessType: true, city: true, imageUrl: true, description: true },
            take: limit,
          });
        }
      })(),

      // Creators
      prisma.creatorProfile.findMany({
        where: {
          status: 'APPROVED',
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
            { bio: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, username: true, fullName: true, avatar: true, bio: true, followerCount: true, verified: true },
        take: limit,
      }),

      // Events
      prisma.placeEvent.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, description: true, imageUrl: true, startDate: true, placeId: true },
        take: limit,
      }),

      // Offers
      prisma.vendorOffer.findMany({
        where: {
          isApproved: true,
          isActive: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, description: true, imageUrl: true, discountValue: true, discountType: true, pointsRequired: true },
        take: limit,
      }),
    ]);

    const totalResults = placesRaw.length + hiddenGemsRaw.length + reelsRaw.length + vendors.length + creators.length + events.length + offers.length;

    // Log the search
    await prisma.searchQueryLog.create({
      data: {
        query: q,
        userId: userId || null,
        resultCount: totalResults,
      },
    }).catch(err => logger.warn({ err, query: q }, 'Failed to log search query'));

    return {
      places: placesRaw,
      hiddenGems: hiddenGemsRaw,
      reels: reelsRaw,
      vendors,
      creators,
      events,
      offers,
      meta: {
        query: q,
        totalResults,
      }
    };
  },

  async getTrendingKeywords() {
    // Basic trending: count recent queries
    const recentLogs = await prisma.searchQueryLog.groupBy({
      by: ['query'],
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 10,
    });
    
    return recentLogs.map(l => ({ keyword: l.query, count: l._count.query }));
  },

  async getSearchAnalytics() {
    const totalSearches = await prisma.searchQueryLog.count();
    const failedSearches = await prisma.searchQueryLog.count({ where: { resultCount: 0 } });
    
    const failedLogs = await prisma.searchQueryLog.groupBy({
      by: ['query'],
      where: { resultCount: 0 },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 20,
    });

    const popularLogs = await prisma.searchQueryLog.groupBy({
      by: ['query'],
      where: { resultCount: { gt: 0 } },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 20,
    });

    return {
      totalSearches,
      failedSearches,
      failedKeywords: failedLogs.map(l => ({ keyword: l.query, count: l._count.query })),
      popularKeywords: popularLogs.map(l => ({ keyword: l.query, count: l._count.query })),
    };
  }
};
