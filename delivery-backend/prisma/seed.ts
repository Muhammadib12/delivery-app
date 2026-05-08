import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cat1 = await prisma.restaurantCategory.upsert({
    where: { name: 'مطاعم عربية' },
    update: {},
    create: { name: 'مطاعم عربية', sortOrder: 1, isActive: true },
  });
  const cat2 = await prisma.restaurantCategory.upsert({
    where: { name: 'وجبات سريعة' },
    update: {},
    create: { name: 'وجبات سريعة', sortOrder: 2, isActive: true },
  });
  await prisma.restaurantCategory.upsert({
    where: { name: 'بيتزا' },
    update: {},
    create: { name: 'بيتزا', sortOrder: 3, isActive: true },
  });

  const r1 = await prisma.restaurant.create({
    data: {
      categoryId: cat1.id,
      name: 'مطعم كابول الأصيل',
      description: 'أشهى المأكولات العربية في كابول',
      address: 'الشارع الرئيسي، كابول',
      latitude: 32.9181,
      longitude: 35.2969,
      status: 'OPEN',
      avgPrepTimeMinutes: 25,
      minOrderAmount: 50,
      deliveryFeeOverride: 15,
      rating: 4.5,
      totalReviews: 120,
    },
  });

  const menuCat = await prisma.menuCategory.create({
    data: { restaurantId: r1.id, name: 'الأطباق الرئيسية', sortOrder: 1 },
  });

  await prisma.product.createMany({
    data: [
      { restaurantId: r1.id, menuCategoryId: menuCat.id, name: 'شاورما دجاج', price: 45, isAvailable: true, sortOrder: 1 },
      { restaurantId: r1.id, menuCategoryId: menuCat.id, name: 'شاورما لحم', price: 55, isAvailable: true, sortOrder: 2 },
      { restaurantId: r1.id, menuCategoryId: menuCat.id, name: 'فلافل', price: 30, isAvailable: true, sortOrder: 3 },
    ],
  });

  await prisma.restaurant.create({
    data: {
      categoryId: cat2.id,
      name: 'بيتزا إكسبرس',
      description: 'بيتزا طازجة بأسرع وقت',
      address: 'حارة الشمال، كابول',
      latitude: 32.9200,
      longitude: 35.2980,
      status: 'OPEN',
      avgPrepTimeMinutes: 20,
      minOrderAmount: 40,
      deliveryFeeOverride: 10,
      rating: 4.2,
      totalReviews: 85,
    },
  });

  console.log('Seed done: 3 categories, 2 restaurants, 3 products');
}

main().catch(console.error).finally(() => prisma.$disconnect());
