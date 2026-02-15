import { useState } from "react";
import { 
  Page, Layout, Card, Text, IndexTable, Thumbnail, Badge, 
  Button, Modal, TextField, FormLayout, BlockStack 
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useLoaderData, useSubmit } from "react-router"; // Sử dụng react-router cho v7
import db from "../db.server";

// 1. LOADER: Tổng hợp dữ liệu từ Shopify + Database của mình
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getProducts {
      products(first: 10) {
        nodes {
          id
          title
          handle
          status
          featuredImage { url altText }
        }
      }
    }`
  );
  const responseJson = await response.json();
  const shopifyProducts = responseJson.data.products.nodes;

  // Lấy danh sách sale đã lưu trong DB
  const dbSales = await db.flashSale.findMany();

  // Khớp dữ liệu: Gắn cấu hình sale vào từng sản phẩm tương ứng
  const productsWithSales = shopifyProducts.map((product) => ({
    ...product,
    saleInfo: dbSales.find((s) => s.productId === product.id) || null,
  }));

  return { products: productsWithSales, shop: session.shop };
};

// 2. ACTION: Trạm xử lý dữ liệu khi bấm nút Save
export const action = async ({ request }) => {
  await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get("productId");
  const productName = formData.get("productName");
  const endsAt = formData.get("endsAt");

  // Ghi vào DB (Nếu có rồi thì cập nhật, chưa có thì tạo mới)
  await db.flashSale.upsert({
    where: { productId },
    update: { endsAt: new Date(endsAt) },
    create: {
      productId,
      productName,
      endsAt: new Date(endsAt),
    },
  });

  return { success: true };
};

// 3. UI COMPONENT
export default function Index() {
  const { products, shop } = useLoaderData();
  const submit = useSubmit();

  // --- QUẢN LÝ TRẠNG THÁI (STATE) ---
  const [activeModal, setActiveModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dateValue, setDateValue] = useState("");

  const handleSave = () => {
    submit(
      { 
        productId: selectedProduct.id, 
        productName: selectedProduct.title, 
        endsAt: dateValue 
      },
      { method: "POST" }
    );
    setActiveModal(false);
  };

  const rowMarkup = products.map(
    (product, index) => {
      const { id, title, featuredImage, status, saleInfo } = product;
      return (
        <IndexTable.Row id={id} key={id} position={index}>
          <IndexTable.Cell>
            <Thumbnail source={featuredImage?.url || ImageIcon} alt={title} size="small" />
          </IndexTable.Cell>
          <IndexTable.Cell><Text fontWeight="bold">{title}</Text></IndexTable.Cell>
          <IndexTable.Cell>
            {saleInfo ? (
              <Badge tone="attention">Sale đến: {new Date(saleInfo.endsAt).toLocaleDateString()}</Badge>
            ) : (
              <Badge tone={status === "ACTIVE" ? "success" : "info"}>{status}</Badge>
            )}
          </IndexTable.Cell>
          <IndexTable.Cell>
            <Button 
              onClick={() => {
                setSelectedProduct(product);
                setDateValue(saleInfo ? new Date(saleInfo.endsAt).toISOString().split('T')[0] : "");
                setActiveModal(true);
              }}
            >
              {saleInfo ? "Sửa Sale" : "Cài đặt"}
            </Button>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    }
  );

  return (
    <Page title="Flash Sale Manager">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={{ singular: "product", plural: "products" }}
              itemCount={products.length}
              headings={[{ title: "" }, { title: "Sản phẩm" }, { title: "Trạng thái" }, { title: "Hành động" }]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {/* MODAL: Cửa sổ nhập liệu */}
      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title={`Cài đặt Flash Sale cho ${selectedProduct?.title}`}
        primaryAction={{ content: "Lưu cài đặt", onAction: handleSave }}
        secondaryActions={[{ content: "Hủy", onAction: () => setActiveModal(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Chọn ngày kết thúc sale"
              type="date"
              value={dateValue}
              onChange={(value) => setDateValue(value)}
              autoComplete="off"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}