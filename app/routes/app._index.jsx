import { useState, useEffect } from "react"; // Thêm useEffect để tránh Hydration error
import { 
  Page, Layout, Card, Text, IndexTable, Thumbnail, Badge, 
  Button, Modal, TextField, FormLayout, EmptyState
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { useLoaderData, useSubmit, useNavigation } from "react-router";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  try {
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
    const shopifyProducts = responseJson.data?.products?.nodes || [];
    const dbSales = await db.flashSale.findMany();

    const productsWithSales = shopifyProducts.map((product) => ({
      ...product,
      saleInfo: dbSales.find((s) => s.productId === product.id) || null,
    }));

    return { products: productsWithSales };
  } catch (error) {
    console.error("Loader Error:", error);
    return { products: [] };
  }
};

export const action = async ({ request }) => {
  // BƯỚC 1: Phải lấy 'admin' từ authenticate ra trước
  const { admin } = await authenticate.admin(request); 
  
  const formData = await request.formData();
  const productId = formData.get("productId");
  const productName = formData.get("productName");
  const endsAt = formData.get("endsAt");

  // BƯỚC 2: Lưu vào Database của mình
  await db.flashSale.upsert({
    where: { productId },
    update: { endsAt: new Date(endsAt) },
    create: {
      productId,
      productName: productName || "",
      endsAt: new Date(endsAt),
    },
  });

  // BƯỚC 3: Đẩy lên Shopify Metafield (Dùng biến 'admin' đã lấy ở trên)
  await admin.graphql(
    `#graphql
    mutation updateProductMetafields($input: ProductInput!) {
      productUpdate(input: $input) {
        product { id }
      }
    }`,
    {
      variables: {
        input: {
          id: productId,
          metafields: [
            {
              namespace: "akira",
              key: "flash_sale",
              type: "single_line_text_field",
              value: endsAt
            }
          ]
        }
      }
    }
  );

  return { success: true };
};

export default function Index() {
  const { products } = useLoaderData();
  const submit = useSubmit();
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";

  const [activeModal, setActiveModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [dateValue, setDateValue] = useState("");

  // Fix lỗi Hydration: Chỉ render ngày tháng sau khi mount vào Client
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!products || products.length === 0) {
    return (
      <Page><Card><EmptyState heading="Không tìm thấy sản phẩm" image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png">
        <p>Vui lòng thêm sản phẩm vào cửa hàng của bạn.</p>
      </EmptyState></Card></Page>
    );
  }

  const rowMarkup = products.map((product, index) => {
    const { id, title, featuredImage, status, saleInfo } = product;
    return (
      <IndexTable.Row id={id} key={id} position={index}>
        <IndexTable.Cell>
          <Thumbnail source={featuredImage?.url || ImageIcon} alt={title} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell><Text fontWeight="bold" as="span">{title}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          {mounted && saleInfo ? (
            <Badge tone="attention">Sale đến: {new Date(saleInfo.endsAt).toLocaleDateString()}</Badge>
          ) : (
            <Badge tone={status === "ACTIVE" ? "success" : "info"}>{status}</Badge>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button onClick={() => {
            setSelectedProduct(product);
            setDateValue(saleInfo ? new Date(saleInfo.endsAt).toISOString().split('T')[0] : "");
            setActiveModal(true);
          }}>
            {saleInfo ? "Sửa Sale" : "Cài đặt"}
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Quản lý Flash Sale">
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

      <Modal
        open={activeModal}
        onClose={() => setActiveModal(false)}
        title={`Cài đặt cho ${selectedProduct?.title}`}
        primaryAction={{ 
          content: "Lưu cài đặt", 
          onAction: () => {
            submit({ productId: selectedProduct.id, productName: selectedProduct.title, endsAt: dateValue }, { method: "POST" });
            setActiveModal(false);
          },
          loading: isSubmitting
        }}
      >
        <Modal.Section>
          <FormLayout>
            <TextField label="Ngày kết thúc" type="date" value={dateValue} onChange={setDateValue} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}