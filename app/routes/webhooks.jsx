import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, payload, admin } = await authenticate.webhook(request);

  switch (topic) {
    case "PRODUCTS_DELETE":
      if (payload.id) {
        // Chuyển ID số thành ID dạng GID của Shopify
        const productId = `gid://shopify/Product/${payload.id}`;
        
        // Thực hiện xóa dữ liệu mồ côi trong Database
        await db.flashSale.deleteMany({
          where: { productId: productId }
        });
        
        console.log(`[Webhook] Đã xóa dữ liệu Flash Sale cho sản phẩm: ${productId}`);
      }
      break;

    // Các trường hợp khác giữ nguyên
    case "APP_UNINSTALLED":
      if (shop) {
        await db.session.deleteMany({ where: { shop } });
      }
      break;
      
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};