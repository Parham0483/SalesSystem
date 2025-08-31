[33mcommit 92d90a3e9d9ba979bb2ca95e7221f53b6dd1799b[m
Author: Parham0483 <163303993+Parham0483@users.noreply.github.com>
Date:   Sun Aug 10 15:27:53 2025 +0330

    updted

[1mdiff --git a/docker-compose.yml b/docker-compose.yml[m
[1mindex a574b7ce..a2af14a9 100644[m
[1m--- a/docker-compose.yml[m
[1m+++ b/docker-compose.yml[m
[36m@@ -2,13 +2,13 @@[m [mservices:[m
   db:[m
     image: postgres:15[m
     environment:[m
[31m-      POSTGRES_DB: salesDb[m
[31m-      POSTGRES_USER: salesuser[m
[31m-      POSTGRES_PASSWORD: yourpassword[m
[32m+[m[32m      POSTGRES_DB: ${DB_NAME:-salesDb}[m
[32m+[m[32m      POSTGRES_USER: ${DB_USER:-salesuser}[m
[32m+[m[32m      POSTGRES_PASSWORD: ${DB_PASSWORD:-parham.0770}[m
     volumes:[m
       - postgres_data:/var/lib/postgresql/data[m
     healthcheck:[m
[31m-      test: ["CMD-SHELL", "pg_isready -U salesuser -d salesDb"][m
[32m+[m[32m      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-salesuser} -d ${DB_NAME:-salesDb}"][m
       interval: 5s[m
       timeout: 5s[m
       retries: 5[m
[36m@@ -20,11 +20,11 @@[m [mservices:[m
     environment:[m
       - DJANGO_SETTINGS_MODULE=mysite.settings_docker[m
       - DATABASE_HOST=db[m
[31m-      - DATABASE_NAME=salesDb[m
[31m-      - DATABASE_USER=salesuser[m
[31m-      - DATABASE_PASSWORD=yourpassword[m
[31m-      - GOOGLE_OAUTH_CLIENT_ID=775814213572-h7009vmkdj87gpuko2puh3n22oesfnj5.apps.googleusercontent.com[m
[31m-      - GOOGLE_OAUTH_CLIENT_SECRET=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[m
[32m+[m[32m      - DATABASE_NAME=${DB_NAME:-salesDb}[m
[32m+[m[32m      - DATABASE_USER=${DB_USER:-salesuser}[m
[32m+[m[32m      - DATABASE_PASSWORD=${DB_PASSWORD:-parham.0770}[m
[32m+[m[32m      - GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}[m
[32m+[m[32m      - GOOGLE_OAUTH_CLIENT_SECRET=${GOOGLE_OAUTH_CLIENT_SECRET}[m
     depends_on:[m
       db:[m
         condition: service_healthy[m
[36m@@ -47,7 +47,7 @@[m [mservices:[m
       - backend[m
     environment:[m
       - REACT_APP_API_URL=/api/[m
[31m-      - REACT_APP_GOOGLE_CLIENT_ID=775814213572-h7009vmkdj87gpuko2puh3n22oesfnj5.apps.googleusercontent.com[m
[32m+[m[32m      - REACT_APP_GOOGLE_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID}[m
     networks:[m
       - app-network[m
 [m
[1mdiff --git a/frontend/src/component/OrderDetailPage.js b/frontend/src/component/OrderDetailPage.js[m
[1mindex 94cb1c38..b72bf8fe 100644[m
[1m--- a/frontend/src/component/OrderDetailPage.js[m
[1m+++ b/frontend/src/component/OrderDetailPage.js[m
[36m@@ -196,27 +196,26 @@[m [mconst InvoiceManager = ({ order, onUpdate }) => {[m
                 <div className="neo-info-item">[m
                     <span className="neo-info-label">مبلغ کل (بدون مالیات)</span>[m
                     <span className="neo-info-value">[m
[31m-                        {invoiceStatus.quoted_total.toLocaleString('fa-IR')} ریال[m
[32m+[m[32m                        {formatPriceFixed(invoiceStatus.quoted_total)}[m
                     </span>[m
                 </div>[m
 [m
[31m-[m
                 {order.business_invoice_type === 'official' && invoiceStatus.tax_breakdown && ([m
                     <>[m
                         {/* Show total tax */}[m
                         <div className="neo-info-item">[m
                             <span className="neo-info-label">مجموع مالیات</span>[m
                             <span className="neo-info-value neo-tax-badge">[m
[31m-                    {invoiceStatus.total_tax_amount.toLocaleString('fa-IR')} ریال[m
[31m-                </span>[m
[32m+[m[32m                                {formatPriceFixed(invoiceStatus.total_tax_amount)}[m
[32m+[m[32m                            </span>[m
                         </div>[m
 [m
                         {/* Show final total */}[m
                         <div className="neo-info-item">[m
                             <span className="neo-info-label">مبلغ نهایی (با مالیات)</span>[m
                             <span className="neo-info-value neo-total-with-tax">[m
[31m-                    {invoiceStatus.total_with_tax.toLocaleString('fa-IR')} ریال[m
[31m-                </span>[m
[32m+[m[32m                                {formatPriceFixed(invoiceStatus.total_with_tax)}[m
[32m+[m[32m                            </span>[m
                         </div>[m
 [m
                         {/* Show tax breakdown by rate if multiple rates exist */}[m
[36m@@ -226,7 +225,7 @@[m [mconst InvoiceManager = ({ order, onUpdate }) => {[m
                                 <div className="tax-breakdown-details">[m
                                     {Object.values(invoiceStatus.tax_breakdown.breakdown_by_rate).map((rateInfo, index) => ([m
                                         <div key={index} className="tax-rate-info">[m
[31m-                                            <span>مالیات {rateInfo.rate}%: {rateInfo.tax_amount.toLocaleString('fa-IR')} ریال</span>[m
[32m+[m[32m                                            <span>مالیات {rateInfo.rate}%: {formatPriceFixed(rateInfo.tax_amount)}</span>[m
                                         </div>[m
                                     ))}[m
                                 </div>[m
[36m@@ -405,6 +404,7 @@[m [mconst InvoiceManager = ({ order, onUpdate }) => {[m
     );[m
 };[m
 [m
[32m+[m[32m// FIXED: Simplified AuthenticatedImage Component - No Authentication Required[m
 const AuthenticatedImage = ({ receipt, onError }) => {[m
     const [imageData, setImageData] = useState(null);[m
     const [loading, setLoading] = useState(true);[m
[36m@@ -412,60 +412,36 @@[m [mconst AuthenticatedImage = ({ receipt, onError }) => {[m
 [m
     useEffect(() => {[m
         if (receipt && receipt.file_type === 'image') {[m
[31m-            loadAuthenticatedImage();[m
[32m+[m[32m            loadImage();[m
         }[m
     }, [receipt]);[m
 [m
[31m-    const loadAuthenticatedImage = async () => {[m
[32m+[m[32m    const loadImage = async () => {[m
         try {[m
             setLoading(true);[m
             setError(null);[m
 [m
[31m-            const token = localStorage.getItem('access_token');[m
[31m-            if (!token) {[m
[31m-                throw new Error('Authentication token not found');[m
[31m-            }[m
[31m-[m
[31m-            const imageUrl = receipt.download_url;[m
[32m+[m[32m            // FIXED: Use direct media URL without authentication[m
[32m+[m[32m            const imageUrl = receipt.file_url || receipt.download_url;[m
 [m
             if (!imageUrl) {[m
[31m-                throw new Error('Download URL not available');[m
[32m+[m[32m                throw new Error('Image URL not available');[m
             }[m
 [m
[31m-            const response = await fetch(imageUrl, {[m
[31m-                method: 'GET',[m
[31m-                headers: {[m
[31m-                    'Authorization': `Bearer ${token}`,[m
[31m-                },[m
[31m-            });[m
[31m-[m
[31m-            if (!response.ok) {[m
[31m-                throw new Error(`HTTP ${response.status}: ${response.statusText}`);[m
[31m-            }[m
[31m-[m
[31m-            const blob = await response.blob();[m
[31m-            const objectUrl = URL.createObjectURL(blob);[m
[31m-            setImageData(objectUrl);[m
[32m+[m[32m            // FIXED: Simple direct access - no authentication needed for media files[m
[32m+[m[32m            setImageData(imageUrl);[m
[32m+[m[32m            setLoading(false);[m
 [m
         } catch (err) {[m
[31m-            console.error('❌ Error loading authenticated image:', err);[m
[32m+[m[32m            console.error('❌ Error loading image:', err);[m
             setError(err.message);[m
[32m+[m[32m            setLoading(false);[m
             if (onError) {[m
                 onError(err);[m
             }[m
[31m-        } finally {[m
[31m-            setLoading(false);[m
         }[m
     };[m
 [m
[31m-    useEffect(() => {[m
[31m-        return () => {[m
[31m-            if (imageData) {[m
[31m-                URL.revokeObjectURL(imageData);[m
[31m-            }[m
[31m-        };[m
[31m-    }, [imageData]);[m
[31m-[m
     if (loading) {[m
         return ([m
             <div className="neo-image-loading" style={{[m
[36m@@ -497,7 +473,7 @@[m [mconst AuthenticatedImage = ({ receipt, onError }) => {[m
                     {error}[m
                 </div>[m
                 <button[m
[31m-                    onClick={loadAuthenticatedImage}[m
[32m+[m[32m                    onClick={loadImage}[m
                     style={{[m
                         padding: '8px 16px',[m
                         backgroundColor: '#3b82f6',[m
[36m@@ -556,6 +532,69 @@[m [mconst AuthenticatedImage = ({ receipt, onError }) => {[m
     );[m
 };[m
 [m
[32m+[m[32m// FIXED: Enhanced price formatting function[m
[32m+[m[32mconst formatPriceFixed = (price) => {[m
[32m+[m[32m    // Handle null, undefined, and zero values properly[m
[32m+[m[32m    if (price === null || price === undefined || isNaN(price)) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const numericPrice = parseFloat(price);[m
[32m+[m[32m    if (numericPrice === 0) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        return `${new Intl.NumberFormat('fa-IR').format(numericPrice)} ریال`;[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error('❌ Price formatting error:', error, 'for price:', price);[m
[32m+[m[32m        return `${numericPrice} ریال`;[m
[32m+[m[32m    }[m
[32m+[m[32m};[m
[32m+[m
[32m+[m[32m// FIXED: Enhanced quantity formatting function[m
[32m+[m[32mconst formatQuantityFixed = (quantity) => {[m
[32m+[m[32m    // Handle null, undefined, and zero values properly[m
[32m+[m[32m    if (quantity === null || quantity === undefined || isNaN(quantity)) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const numericQuantity = parseInt(quantity);[m
[32m+[m[32m    if (numericQuantity === 0) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        return new Intl.NumberFormat('fa-IR').format(numericQuantity);[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error('❌ Quantity formatting error:', error, 'for quantity:', quantity);[m
[32m+[m[32m        return numericQuantity.toString();[m
[32m+[m[32m    }[m
[32m+[m[32m};[m
[32m+[m
[32m+[m[32m// FIXED: Enhanced total calculation function[m
[32m+[m[32mconst calculateTotalFixed = (unitPrice, quantity) => {[m
[32m+[m[32m    // Handle null, undefined, and zero values properly[m
[32m+[m[32m    if (!unitPrice || !quantity || isNaN(unitPrice) || isNaN(quantity)) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const numericPrice = parseFloat(unitPrice);[m
[32m+[m[32m    const numericQuantity = parseInt(quantity);[m
[32m+[m
[32m+[m[32m    if (numericPrice === 0 || numericQuantity === 0) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        const total = numericPrice * numericQuantity;[m
[32m+[m[32m        return `${new Intl.NumberFormat('fa-IR').format(total)} ریال`;[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error('❌ Total calculation error:', error, 'for price:', unitPrice, 'quantity:', quantity);[m
[32m+[m[32m        return 'خطا در محاسبه';[m
[32m+[m[32m    }[m
[32m+[m[32m};[m
[32m+[m
 const OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
     const [order, setOrder] = useState(null);[m
     const [loading, setLoading] = useState(true);[m
[36m@@ -661,41 +700,24 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         }[m
     };[m
 [m
[32m+[m[32m    // FIXED: Simplified download function - no authentication needed[m
     const handleDownloadReceipt = async (receipt) => {[m
         try {[m
[31m-            const downloadUrl = receipt.download_url;[m
[32m+[m[32m            const downloadUrl = receipt.file_url || receipt.download_url;[m
 [m
             if (!downloadUrl) {[m
                 alert('لینک دانلود در دسترس نیست');[m
                 return;[m
             }[m
 [m
[31m-            const token = localStorage.getItem('access_token');[m
[31m-            if (!token) {[m
[31m-                alert('لطفاً دوباره وارد شوید');[m
[31m-                return;[m
[31m-            }[m
[31m-[m
[31m-            const response = await fetch(downloadUrl, {[m
[31m-                method: 'GET',[m
[31m-                headers: {[m
[31m-                    'Authorization': `Bearer ${token}`,[m
[31m-                },[m
[31m-            });[m
[31m-[m
[31m-            if (!response.ok) {[m
[31m-                throw new Error(`HTTP ${response.status}: ${response.statusText}`);[m
[31m-            }[m
[31m-[m
[31m-            const blob = await response.blob();[m
[31m-            const blobUrl = URL.createObjectURL(blob);[m
[32m+[m[32m            // FIXED: Simple direct download - no authentication needed[m
             const link = document.createElement('a');[m
[31m-            link.href = blobUrl;[m
[32m+[m[32m            link.href = downloadUrl;[m
             link.download = receipt.file_name;[m
[32m+[m[32m            link.target = '_blank';[m
             document.body.appendChild(link);[m
             link.click();[m
             document.body.removeChild(link);[m
[31m-            URL.revokeObjectURL(blobUrl);[m
 [m
         } catch (error) {[m
             console.error('❌ Error downloading file:', error);[m
[36m@@ -703,46 +725,25 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         }[m
     };[m
 [m
[32m+[m[32m    // FIXED: Simplified PDF view function - no authentication needed[m
     const handleViewPDF = async (receipt) => {[m
         try {[m
[31m-            const viewUrl = receipt.file_url;[m
[32m+[m[32m            const viewUrl = receipt.file_url || receipt.download_url;[m
 [m
             if (!viewUrl) {[m
                 alert('فایل PDF در دسترس نیست');[m
                 return;[m
             }[m
 [m
[31m-            const token = localStorage.getItem('access_token');[m
[31m-            if (!token) {[m
[31m-                alert('لطفاً دوباره وارد شوید');[m
[31m-                return;[m
[31m-            }[m
[31m-[m
[31m-            const response = await fetch(viewUrl, {[m
[31m-                method: 'GET',[m
[31m-                headers: {[m
[31m-                    'Authorization': `Bearer ${token}`,[m
[31m-                },[m
[31m-            });[m
[31m-[m
[31m-            if (!response.ok) {[m
[31m-                throw new Error(`HTTP ${response.status}: ${response.statusText}`);[m
[31m-            }[m
[31m-[m
[31m-            const blob = await response.blob();[m
[31m-            const blobUrl = URL.createObjectURL(blob);[m
[31m-            const newWindow = window.open(blobUrl, '_blank');[m
[32m+[m[32m            // FIXED: Direct PDF view - no authentication needed[m
[32m+[m[32m            const newWindow = window.open(viewUrl, '_blank');[m
 [m
             if (!newWindow) {[m
[32m+[m[32m                // Fallback to download if popup blocked[m
                 const link = document.createElement('a');[m
[31m-                link.href = blobUrl;[m
[32m+[m[32m                link.href = viewUrl;[m
                 link.download = receipt.file_name;[m
                 link.click();[m
[31m-                URL.revokeObjectURL(blobUrl);[m
[31m-            } else {[m
[31m-                setTimeout(() => {[m
[31m-                    URL.revokeObjectURL(blobUrl);[m
[31m-                }, 60000);[m
             }[m
 [m
         } catch (error) {[m
[36m@@ -769,7 +770,7 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                     <div className="neo-pdf-preview">[m
                         <p className="neo-pdf-name">{receipt.file_name}</p>[m
                         <NeoBrutalistButton[m
[31m-                            text=" مشاهده PDF"[m
[32m+[m[32m                            text="📄 مشاهده PDF"[m
                             color="blue-400"[m
                             textColor="white"[m
                             onClick={() => handleViewPDF(receipt)}[m
[36m@@ -881,23 +882,14 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         return statusMap[status] || status;[m
     };[m
 [m
[31m-    const formatPrice = (price) => {[m
[31m-        if (!price || price === 0) return 'در انتظار';[m
[31m-        return `${new Intl.NumberFormat('fa-IR').format(price)} ریال`;[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced formatPriceFixed function[m
[32m+[m[32m    const formatPrice = (price) => formatPriceFixed(price);[m
 [m
[31m-    const formatQuantity = (quantity) => {[m
[31m-        if (!quantity || quantity === 0) return 'در انتظار';[m
[31m-        return new Intl.NumberFormat('fa-IR').format(quantity);[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced formatQuantityFixed function[m
[32m+[m[32m    const formatQuantity = (quantity) => formatQuantityFixed(quantity);[m
 [m
[31m-    const calculateTotal = (unitPrice, quantity) => {[m
[31m-        if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {[m
[31m-            return 'در انتظار';[m
[31m-        }[m
[31m-        const total = unitPrice * quantity;[m
[31m-        return `${new Intl.NumberFormat('fa-IR').format(total)} ریال`;[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced calculateTotalFixed function[m
[32m+[m[32m    const calculateTotal = (unitPrice, quantity) => calculateTotalFixed(unitPrice, quantity);[m
 [m
     const truncateText = (text, maxLength = 30) => {[m
         if (!text) return '-';[m
[36m@@ -1118,7 +1110,7 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                             gap: '0.5rem',[m
                                             border: '2px solid #059669'[m
                                         }}>[m
[31m-                                            <span>اطلاعات فاکتور رسمی کامل است</span>[m
[32m+[m[32m                                            <span>✅ اطلاعات فاکتور رسمی کامل است</span>[m
                                         </div>[m
                                     ) : ([m
                                         <div className="readiness-indicator incomplete" style={{[m
[36m@@ -1205,7 +1197,7 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                                 <span className={`neo-info-value ${[m
                                                     receipt.is_verified ? 'neo-receipt-verified' : 'neo-receipt-pending'[m
                                                 }`}>[m
[31m-                                                    {receipt.is_verified ? ' تایید شده' : ' در انتظار بررسی'}[m
[32m+[m[32m                                                    {receipt.is_verified ? '✅ تایید شده' : '⏳ در انتظار بررسی'}[m
                                                 </span>[m
                                             </div>[m
                                         </div>[m
[36m@@ -1216,7 +1208,7 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                     {/* Receipt actions */}[m
                                     <div className="neo-receipt-actions">[m
                                         <NeoBrutalistButton[m
[31m-                                            text=" دانلود"[m
[32m+[m[32m                                            text="📥 دانلود"[m
                                             color="green-400"[m
                                             textColor="black"[m
                                             onClick={() => handleDownloadReceipt(receipt)}[m
[36m@@ -1226,7 +1218,7 @@[m [mconst OrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                         {/* Allow deletion only if order is still in confirmed status */}[m
                                         {order.status === 'confirmed' && ([m
                                             <NeoBrutalistButton[m
[31m-                                                text="حذف"[m
[32m+[m[32m                                                text="🗑️ حذف"[m
                                                 color="red-400"[m
                                                 textColor="white"[m
                                                 onClick={() => deletePaymentReceipt(receipt.id)}[m
[1mdiff --git a/frontend/src/pages/admin/AdminAnnouncementsPage.js b/frontend/src/pages/admin/AdminAnnouncementsPage.js[m
[1mindex 3882ae23..5f5487d1 100644[m
[1m--- a/frontend/src/pages/admin/AdminAnnouncementsPage.js[m
[1m+++ b/frontend/src/pages/admin/AdminAnnouncementsPage.js[m
[36m@@ -184,7 +184,7 @@[m [mconst AdminAnnouncementsPage = () => {[m
                 estimated_arrival: announcement.estimated_arrival ? announcement.estimated_arrival.split('T')[0] : ''[m
             };[m
             setFormData(formattedAnnouncement);[m
[31m-            setImagePreviews(announcement.images ? announcement.images.map(img => img.image) : []);[m
[32m+[m[32m            setImagePreviews(announcement.image ? announcement.image.map(img => img.image) : []);[m
         } else {[m
             setFormData({[m
                 title: '',[m
[36m@@ -223,7 +223,7 @@[m [mconst AdminAnnouncementsPage = () => {[m
 [m
         if (files.length) {[m
             // Validate file types and sizes[m
[31m-            const allowedTypes = ['image/jpeg', 'image/jpg', 'images/png', 'image/gif', 'image/webp'];[m
[32m+[m[32m            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];[m
             const maxSize = 5 * 1024 * 1024; // 5MB[m
 [m
             const validFiles = [];[m
[36m@@ -955,7 +955,7 @@[m [mconst AdminAnnouncementsPage = () => {[m
                             type="file"[m
                             onChange={handleFileChange}[m
                             multiple[m
[31m-                            accept="images/jpeg,images/jpg,images/png,images/gif,images/webp"[m
[32m+[m[32m                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"[m
                             className="file-input"[m
                         />[m
                         <p className="file-help-text">[m
[1mdiff --git a/frontend/src/pages/admin/component/AdminOrderDetailPage.js b/frontend/src/pages/admin/component/AdminOrderDetailPage.js[m
[1mindex e4223c43..1f610bbc 100644[m
[1m--- a/frontend/src/pages/admin/component/AdminOrderDetailPage.js[m
[1m+++ b/frontend/src/pages/admin/component/AdminOrderDetailPage.js[m
[36m@@ -7,6 +7,133 @@[m [mimport NeoBrutalistButton from '../../../component/NeoBrutalist/NeoBrutalistButt[m
 import NeoBrutalistInput from '../../../component/NeoBrutalist/NeoBrutalistInput';[m
 import '../../../styles/component/AdminComponent/AdminOrderDetail.css';[m
 [m
[32m+[m[32m// UPDATED: Admin Invoice Manager Component[m
[32m+[m[32mconst AdminInvoiceManager = ({ order, onUpdate }) => {[m
[32m+[m[32m    const [loading, setLoading] = useState(false);[m
[32m+[m[32m    const [invoiceStatus, setInvoiceStatus] = useState(null);[m
[32m+[m[32m    const [loadingStatus, setLoadingStatus] = useState(false);[m
[32m+[m
[32m+[m[32m    useEffect(() => {[m
[32m+[m[32m        if (order) {[m
[32m+[m[32m            fetchInvoiceStatus();[m
[32m+[m[32m        }[m
[32m+[m[32m    }, [order]);[m
[32m+[m
[32m+[m[32m    const fetchInvoiceStatus = async () => {[m
[32m+[m[32m        setLoadingStatus(true);[m
[32m+[m[32m        try {[m
[32m+[m[32m            const response = await API.get(`/orders/${order.id}/invoice-status/`);[m
[32m+[m[32m            setInvoiceStatus(response.data);[m
[32m+[m[32m        } catch (error) {[m
[32m+[m[32m            console.error('❌ Error fetching admin invoice status:', error);[m
[32m+[m[32m        } finally {[m
[32m+[m[32m            setLoadingStatus(false);[m
[32m+[m[32m        }[m
[32m+[m[32m    };[m
[32m+[m
[32m+[m[32m    const downloadFinalInvoice = async () => {[m
[32m+[m[32m        setLoading(true);[m
[32m+[m[32m        try {[m
[32m+[m[32m            const response = await API.get(`/orders/${order.id}/download-final-invoice/`, {[m
[32m+[m[32m                responseType: 'blob'[m
[32m+[m[32m            });[m
[32m+[m
[32m+[m[32m            const blob = new Blob([response.data], { type: 'application/pdf' });[m
[32m+[m[32m            const url = window.URL.createObjectURL(blob);[m
[32m+[m[32m            const link = document.createElement('a');[m
[32m+[m[32m            link.href = url;[m
[32m+[m[32m            link.download = `final_invoice_${order.id}_${order.business_invoice_type}.pdf`;[m
[32m+[m[32m            document.body.appendChild(link);[m
[32m+[m[32m            link.click();[m
[32m+[m[32m            link.remove();[m
[32m+[m[32m            window.URL.revokeObjectURL(url);[m
[32m+[m[32m        } catch (err) {[m
[32m+[m[32m            console.error('❌ Admin error downloading final invoice:', err);[m
[32m+[m[32m            if (err.response?.data?.error) {[m
[32m+[m[32m                alert(`خطا: ${err.response.data.error}`);[m
[32m+[m[32m            } else {[m
[32m+[m[32m                alert('خطا در دانلود فاکتور نهایی');[m
[32m+[m[32m            }[m
[32m+[m[32m        } finally {[m
[32m+[m[32m            setLoading(false);[m
[32m+[m[32m        }[m
[32m+[m[32m    };[m
[32m+[m
[32m+[m[32m    if (loadingStatus) {[m
[32m+[m[32m        return ([m
[32m+[m[32m            <div className="neo-invoice-card">[m
[32m+[m[32m                <div className="neo-loading-content">[m
[32m+[m[32m                    <span>🔄 در حال بارگیری وضعیت فاکتور...</span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m            </div>[m
[32m+[m[32m        );[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    if (!invoiceStatus) {[m
[32m+[m[32m        return null; // Don't render if there's an error or no status[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    return ([m
[32m+[m[32m        <NeoBrutalistCard className="neo-invoice-card" style={{ borderLeft: '6px solid #10b981' }}>[m
[32m+[m[32m            <div className="neo-card-header">[m
[32m+[m[32m                <h3 className="neo-card-title">مدیریت فاکتور (ادمین)</h3>[m
[32m+[m[32m                <div className="neo-invoice-status-badges">[m
[32m+[m[32m                    {invoiceStatus.pre_invoice_available && ([m
[32m+[m[32m                        <span className="neo-badge neo-badge-info">پیش‌فاکتور موجود</span>[m
[32m+[m[32m                    )}[m
[32m+[m[32m                    {invoiceStatus.final_invoice_available && ([m
[32m+[m[32m                        <span className="neo-badge neo-badge-success">فاکتور نهایی موجود</span>[m
[32m+[m[32m                    )}[m
[32m+[m[32m                    {invoiceStatus.payment_verified && ([m
[32m+[m[32m                        <span className="neo-badge neo-badge-verified">پرداخت تأیید شده</span>[m
[32m+[m[32m                    )}[m
[32m+[m[32m                </div>[m
[32m+[m[32m            </div>[m
[32m+[m
[32m+[m[32m            <div className="neo-invoice-info-grid">[m
[32m+[m[32m                <div className="neo-info-item">[m
[32m+[m[32m                    <span className="neo-info-label">نوع فاکتور</span>[m
[32m+[m[32m                    <span className={`neo-info-value ${order.business_invoice_type === 'official' ? 'neo-official-invoice' : 'neo-unofficial-invoice'}`}>[m
[32m+[m[32m                        {invoiceStatus.business_invoice_type_display}[m
[32m+[m[32m                    </span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m                <div className="neo-info-item">[m
[32m+[m[32m                    <span className="neo-info-label">مبلغ کل</span>[m
[32m+[m[32m                    <span className="neo-info-value neo-payable-amount">[m
[32m+[m[32m                        {order.business_invoice_type === 'official' ? formatPriceFixed(invoiceStatus.total_with_tax) : formatPriceFixed(invoiceStatus.quoted_total)}[m
[32m+[m[32m                    </span>[m
[32m+[m[32m                </div>[m
[32m+[m[32m                {order.status === 'completed' && ([m
[32m+[m[32m                    <div className="neo-info-item">[m
[32m+[m[32m                        <span className="neo-info-label">وضعیت</span>[m
[32m+[m[32m                        <span className="neo-info-value" style={{ color: '#059669', fontWeight: 'bold' }}>[m
[32m+[m[32m                             سفارش تکمیل شده[m
[32m+[m[32m                        </span>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                )}[m
[32m+[m[32m            </div>[m
[32m+[m
[32m+[m[32m            <div className="neo-invoice-actions">[m
[32m+[m[32m                {invoiceStatus.can_download_final_invoice && ([m
[32m+[m[32m                    <div className="neo-action-group">[m
[32m+[m[32m                        <h4 className="neo-action-group-title">فاکتور نهایی</h4>[m
[32m+[m[32m                        <div className="neo-action-buttons">[m
[32m+[m[32m                            <button[m
[32m+[m[32m                                className="neo-btn neo-btn-primary"[m
[32m+[m[32m                                onClick={downloadFinalInvoice}[m
[32m+[m[32m                                disabled={loading}[m
[32m+[m[32m                            >[m
[32m+[m[32m                                {loading ? 'در حال دانلود...' : 'دانلود فاکتور نهایی'}[m
[32m+[m[32m                            </button>[m
[32m+[m[32m                        </div>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                )}[m
[32m+[m[32m            </div>[m
[32m+[m[32m        </NeoBrutalistCard>[m
[32m+[m[32m    );[m
[32m+[m[32m};[m
[32m+[m
[32m+[m
 const BusinessInvoiceTypeUpdate = ({ order, onUpdate }) => {[m
     const [newInvoiceType, setNewInvoiceType] = useState(order.business_invoice_type);[m
     const [updating, setUpdating] = useState(false);[m
[36m@@ -123,6 +250,55 @@[m [mconst BusinessInvoiceTypeUpdate = ({ order, onUpdate }) => {[m
     );[m
 };[m
 [m
[32m+[m[32m// FIXED: Enhanced price formatting function[m
[32m+[m[32mconst formatPriceFixed = (price) => {[m
[32m+[m[32m    // Handle null, undefined, and zero values properly[m
[32m+[m[32m    if (price === null || price === undefined || isNaN(price)) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const numericPrice = parseFloat(price);[m
[32m+[m[32m    if (numericPrice === 0) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        return `${new Intl.NumberFormat('fa-IR').format(numericPrice)} ریال`;[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error('❌ Admin price formatting error:', error, 'for price:', price);[m
[32m+[m[32m        return `${numericPrice} ریال`;[m
[32m+[m[32m    }[m
[32m+[m[32m};[m
[32m+[m
[32m+[m[32m// FIXED: Enhanced quantity formatting function[m
[32m+[m[32mconst formatQuantityFixed = (quantity) => {[m
[32m+[m[32m    // Handle null, undefined, and zero values properly[m
[32m+[m[32m    if (quantity === null || quantity === undefined || isNaN(quantity)) {[m
[32m+[m[32m        return '';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    const numericQuantity = parseInt(quantity);[m
[32m+[m[32m    if (numericQuantity === 0) {[m
[32m+[m[32m        return '';[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    try {[m
[32m+[m[32m        return new Intl.NumberFormat('fa-IR').format(numericQuantity);[m
[32m+[m[32m    } catch (error) {[m
[32m+[m[32m        console.error('❌ Admin quantity formatting error:', error, 'for quantity:', quantity);[m
[32m+[m[32m        return numericQuantity.toString();[m
[32m+[m[32m    }[m
[32m+[m[32m};[m
[32m+[m
[32m+[m[32m// FIXED: Enhanced total calculation function for admin[m
[32m+[m[32mconst calculateTotalFixed = (unitPrice, quantity) => {[m
[32m+[m[32m    if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {[m
[32m+[m[32m        return 'در انتظار';[m
[32m+[m[32m    }[m
[32m+[m[32m    const total = parseFloat(unitPrice) * parseInt(quantity);[m
[32m+[m[32m    return formatPriceFixed(total).replace(' ریال', '');[m
[32m+[m[32m};[m
[32m+[m
 const AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
     const [order, setOrder] = useState(null);[m
     const [items, setItems] = useState([]);[m
[36m@@ -147,7 +323,6 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         }[m
     }, [order]);[m
 [m
[31m-[m
     useEffect(() => {[m
         if (order?.customer) {[m
             fetchCustomerInfo();[m
[36m@@ -208,7 +383,6 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         return order?.business_invoice_type === 'official';[m
     };[m
 [m
[31m-[m
     const handleCompleteOrder = async () => {[m
         if (!window.confirm('آیا مطمئن هستید که می‌خواهید این سفارش را تکمیل کنید؟')) {[m
             return;[m
[36m@@ -379,23 +553,14 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         return statusMap[status] || status;[m
     };[m
 [m
[31m-    const formatPrice = (price) => {[m
[31m-        if (!price || price === 0) return 'در انتظار';[m
[31m-        return `${new Intl.NumberFormat('fa-IR').format(price)} ریال`;[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced formatPriceFixed function[m
[32m+[m[32m    const formatPrice = (price) => formatPriceFixed(price);[m
 [m
[31m-    const formatQuantity = (quantity) => {[m
[31m-        if (!quantity || quantity === 0) return '';[m
[31m-        return new Intl.NumberFormat('fa-IR').format(quantity);[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced formatQuantityFixed function[m
[32m+[m[32m    const formatQuantity = (quantity) => formatQuantityFixed(quantity);[m
 [m
[31m-    const calculateTotal = (unitPrice, quantity) => {[m
[31m-        if (!unitPrice || !quantity || unitPrice === 0 || quantity === 0) {[m
[31m-            return 'در انتظار';[m
[31m-        }[m
[31m-        const total = parseFloat(unitPrice) * parseInt(quantity);[m
[31m-        return formatPrice(total).replace(' ریال', '');[m
[31m-    };[m
[32m+[m[32m    // FIXED: Use the enhanced calculateTotalFixed function[m
[32m+[m[32m    const calculateTotal = (unitPrice, quantity) => calculateTotalFixed(unitPrice, quantity);[m
 [m
     // ADDED: Helper to calculate tax for one item[m
     const calculateItemTax = (unitPrice, quantity, taxRate) => {[m
[36m@@ -412,7 +577,6 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
         return subtotal + tax;[m
     };[m
 [m
[31m-[m
     const calculateOrderTotal = () => {[m
         const subtotal = items.reduce((sum, item) => {[m
             if (item.quoted_unit_price && item.final_quantity) {[m
[36m@@ -563,6 +727,11 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                 </div>[m
             </NeoBrutalistCard>[m
 [m
[32m+[m[32m            {/* UPDATED: Admin Invoice Manager Component Render Call */}[m
[32m+[m[32m            {(order.status === 'waiting_customer_approval' || order.status === 'confirmed' || order.status === 'payment_uploaded' || order.status === 'completed') && ([m
[32m+[m[32m                <AdminInvoiceManager order={order} onUpdate={fetchOrder} />[m
[32m+[m[32m            )}[m
[32m+[m
             {/* Customer Invoice Information (for official invoices) */}[m
             {isOfficialInvoice() && ([m
                 <NeoBrutalistCard className="admin-customer-invoice-card">[m
[36m@@ -630,7 +799,6 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                                 gap: '0.5rem',[m
                                                 border: '2px solid #059669'[m
                                             }}>[m
[31m-                                                <span>✅</span>[m
                                                 <span>اطلاعات فاکتور رسمی کامل است</span>[m
                                             </div>[m
                                         ) : ([m
[36m@@ -838,11 +1006,12 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                 </form>[m
             </NeoBrutalistCard>[m
 [m
[31m-            {/* Payment Verification Section */}[m
[31m-            {(order.status === 'payment_uploaded') && ([m
[32m+[m[32m            {(order.status === 'payment_uploaded' || (order.status === 'completed' && order.has_payment_receipts)) && ([m
                 <NeoBrutalistCard className="admin-payment-verification-card">[m
                     <div className="admin-card-header">[m
[31m-                        <h2 className="admin-card-title">تایید پرداخت</h2>[m
[32m+[m[32m                        <h2 className="admin-card-title">[m
[32m+[m[32m                            {order.status === 'completed' ? 'رسیدهای پرداخت تایید شده' : 'تایید پرداخت'}[m
[32m+[m[32m                        </h2>[m
                     </div>[m
                     <PaymentVerificationComponent[m
                         orderId={order.id}[m
[36m@@ -877,7 +1046,6 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
             {/* Success Message */}[m
             {!error && (submitting || completing) && ([m
                 <div className="admin-status-message admin-success">[m
[31m-                    <span className="admin-status-icon">✅</span>[m
                     <span>[m
                         {submitting && "قیمت‌گذاری در حال ثبت..."}[m
                         {completing && "سفارش در حال تکمیل..."}[m
[36m@@ -885,7 +1053,7 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                 </div>[m
             )}[m
 [m
[31m-            {/* Payment Information Display */}[m
[32m+[m[32m            {/* MODIFIED: Payment Information Display - Always show for relevant statuses, hide receipt numbers for completed orders */}[m
             {(order.status === 'payment_uploaded' || order.status === 'confirmed' || order.status === 'completed') && ([m
                 <NeoBrutalistCard className="admin-order-info-card">[m
                     <div className="admin-card-header">[m
[36m@@ -898,10 +1066,13 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                     <span className="admin-info-label">نوع پرداخت</span>[m
                                     <span className="admin-info-value">رسیدهای متعدد</span>[m
                                 </div>[m
[31m-                                <div className="admin-info-item">[m
[31m-                                    <span className="admin-info-label">تعداد رسیدها</span>[m
[31m-                                    <span className="admin-info-value">{order.payment_receipts_count || 'نامشخص'}</span>[m
[31m-                                </div>[m
[32m+[m[32m                                {/* MODIFIED: Hide receipt count for completed orders */}[m
[32m+[m[32m                                {order.status !== 'completed' && ([m
[32m+[m[32m                                    <div className="admin-info-item">[m
[32m+[m[32m                                        <span className="admin-info-label">تعداد رسیدها</span>[m
[32m+[m[32m                                        <span className="admin-info-value">{order.payment_receipts_count || 'نامشخص'}</span>[m
[32m+[m[32m                                    </div>[m
[32m+[m[32m                                )}[m
                             </>[m
                         ) : ([m
                             <>[m
[36m@@ -930,9 +1101,19 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                                 <span className="admin-info-value">{order.payment_notes}</span>[m
                             </div>[m
                         )}[m
[32m+[m
[32m+[m[32m                        {/* MODIFIED: Show completion status for completed orders */}[m
[32m+[m[32m                        {order.status === 'completed' && ([m
[32m+[m[32m                            <div className="admin-info-item">[m
[32m+[m[32m                                <span className="admin-info-label">وضعیت پرداخت</span>[m
[32m+[m[32m                                <span className="admin-info-value" style={{ color: '#059669', fontWeight: 'bold' }}>[m
[32m+[m[32m                                     تایید شده و تکمیل شده[m
[32m+[m[32m                                </span>[m
[32m+[m[32m                            </div>[m
[32m+[m[32m                        )}[m
                     </div>[m
 [m
[31m-                    {/* Show legacy single receipt if exists */}[m
[32m+[m[32m                    {/* MODIFIED: Always show receipt images regardless of order status */}[m
                     {order.payment_receipt && !order.has_payment_receipts && ([m
                         <div className="payment-receipt-view">[m
                             <h4>رسید پرداخت:</h4>[m
[36m@@ -951,6 +1132,24 @@[m [mconst AdminOrderDetailPage = ({ orderId, onOrderUpdated }) => {[m
                             />[m
                         </div>[m
                     )}[m
[32m+[m
[32m+[m[32m                    {/* MODIFIED: Show completion message for completed orders, but keep receipts visible */}[m
[32m+[m[32m                    {order.status === 'completed' && (order.payment_receipt || order.has_payment_receipts) && ([m
[32m+[m[32m                        <div className="completed-payment-message" style={{[m
[32m+[m[32m                            backgroundColor: '#d1fae5',[m
[32m+[m[32m                            padding: '0.75rem',[m
[32m+[m[32m                            borderRadius: '6px',[m
[32m+[m[32m                            marginTop: '1rem',[m
[32m+[m[32m                            color: '#059669',[m
[32m+[m[32m                            border: '2px solid #059669',[m
[32m+[m[32m                            textAlign: 'center',[m
[32m+[m[32m                            fontSize: '0.9rem'[m
[32m+[m[32m                        }}>[m
[32m+[m[32m                            <span style={{ marginLeft: '0.5rem' }}>[m
[32m+[m[32m                                پرداخت تایید شده و سفارش تکمیل شده[m
[32m+[m[32m                            </span>[m
[32m+[m[32m                        </div>[m
[32m+[m[32m                    )}[m
                 </NeoBrutalistCard>[m
             )}[m
         </div>[m
[1mdiff --git a/frontend/src/pages/admin/component/PaymentVerificationComponent.js b/frontend/src/pages/admin/component/PaymentVerificationComponent.js[m
[1mindex 2777d37d..39221fa7 100644[m
[1m--- a/frontend/src/pages/admin/component/PaymentVerificationComponent.js[m
[1m+++ b/frontend/src/pages/admin/component/PaymentVerificationComponent.js[m
[36m@@ -532,6 +532,7 @@[m [mconst PaymentVerificationComponent = ({ order, onPaymentVerified, AuthenticatedI[m
                 </div>[m
             )}[m
 [m
[32m+[m[32m            {order.status !== 'completed' && ([m
             <div className="verification-form">[m
                 <div className="notes-section">[m
                     <label>یادداشت‌های پرداخت (اختیاری)</label>[m
[36m@@ -564,6 +565,7 @@[m [mconst PaymentVerificationComponent = ({ order, onPaymentVerified, AuthenticatedI[m
                     />[m
                 </div>[m
             </div>[m
[32m+[m[32m            )}[m
 [m
             {isImageModalOpen && ([m
                 <div[m
[1mdiff --git a/frontend/src/styles/component/AdminComponent/AdminOrderDetail.css b/frontend/src/styles/component/AdminComponent/AdminOrderDetail.css[m
[1mindex 321a11e5..1eff593c 100644[m
[1m--- a/frontend/src/styles/component/AdminComponent/AdminOrderDetail.css[m
[1m+++ b/frontend/src/styles/component/AdminComponent/AdminOrderDetail.css[m
[36m@@ -442,4 +442,198 @@[m
         max-width: 150px;[m
         flex-grow: 1;[m
     }[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-invoice-card .neo-card-header {[m
[32m+[m[32m    padding: 1rem 1.5rem;[m
[32m+[m[32m    border-bottom: 3px solid #000;[m
[32m+[m[32m    background-color: #f8f9fa;[m
[32m+[m[32m    text-align: right;[m
[32m+[m[32m    display: flex;[m
[32m+[m[32m    justify-content: space-between;[m
[32m+[m[32m    align-items: center;[m
[32m+[m[32m    flex-wrap: wrap;[m
[32m+[m[32m    gap: 1rem;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-invoice-status-badges {[m
[32m+[m[32m    display: flex;[m
[32m+[m[32m    gap: 0.5rem;[m
[32m+[m[32m    flex-wrap: wrap;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-badge {[m
[32m+[m[32m    padding: 6px 12px;[m
[32m+[m[32m    border: 2px solid #000;[m
[32m+[m[32m    font-family: 'Tahoma', sans-serif;[m
[32m+[m[32m    font-size: 12px;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    text-transform: uppercase;[m
[32m+[m[32m    letter-spacing: 0.5px;[m
[32m+[m[32m    box-shadow: 2px 2px #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-badge-info {[m
[32m+[m[32m    background-color: #3b82f6;[m
[32m+[m[32m    color: white;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-badge-success {[m
[32m+[m[32m    background-color: #059669;[m
[32m+[m[32m    color: white;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-badge-verified {[m
[32m+[m[32m    background-color: #facc15;[m
[32m+[m[32m    color: #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-info-value.neo-invoice-number {[m
[32m+[m[32m    background-color: #f3f4f6;[m
[32m+[m[32m    padding: 8px 12px;[m
[32m+[m[32m    border: 2px solid #000;[m
[32m+[m[32m    font-family: 'Courier New', monospace;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    box-shadow: 2px 2px #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-info-value.neo-total-with-tax {[m
[32m+[m[32m    font-size: 1.25rem;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    color: #dc2626;[m
[32m+[m[32m    background-color: #fef2f2;[m
[32m+[m[32m    padding: 8px 12px;[m
[32m+[m[32m    border: 2px solid #dc2626;[m
[32m+[m[32m    box-shadow: 2px 2px #dc2626;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-invoice-actions {[m
[32m+[m[32m    display: flex;[m
[32m+[m[32m    flex-direction: column;[m
[32m+[m[32m    gap: 1.5rem;[m
[32m+[m[32m    padding: 1.5rem;[m
[32m+[m[32m    direction: rtl;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-action-group {[m
[32m+[m[32m    border: 3px solid #000;[m
[32m+[m[32m    background-color: #fff;[m
[32m+[m[32m    box-shadow: 4px 4px #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-action-group-title {[m
[32m+[m[32m    font-family: 'Bebas Neue', sans-serif;[m
[32m+[m[32m    font-size: 1.2rem;[m
[32m+[m[32m    letter-spacing: 1px;[m
[32m+[m[32m    margin: 0;[m
[32m+[m[32m    padding: 0.75rem 1rem;[m
[32m+[m[32m    background-color: #f8f9fa;[m
[32m+[m[32m    border-bottom: 2px solid #000;[m
[32m+[m[32m    color: #1a1a1a;[m
[32m+[m[32m    text-transform: uppercase;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-action-buttons {[m
[32m+[m[32m    padding: 1rem;[m
[32m+[m[32m    display: flex;[m
[32m+[m[32m    gap: 1rem;[m
[32m+[m[32m    flex-wrap: wrap;[m
[32m+[m[32m    justify-content: center;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn {[m
[32m+[m[32m    padding: 12px 24px;[m
[32m+[m[32m    border: 3px solid #000;[m
[32m+[m[32m    background-color: #fff;[m
[32m+[m[32m    color: #000;[m
[32m+[m[32m    font-family: 'Bebas Neue', sans-serif;[m
[32m+[m[32m    font-size: 14px;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    text-transform: uppercase;[m
[32m+[m[32m    letter-spacing: 1px;[m
[32m+[m[32m    cursor: pointer;[m
[32m+[m[32m    transition: all 0.2s ease;[m
[32m+[m[32m    box-shadow: 4px 4px #000;[m
[32m+[m[32m    text-decoration: none;[m
[32m+[m[32m    display: inline-block;[m
[32m+[m[32m    text-align: center;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn:hover {[m
[32m+[m[32m    transform: translate(-2px, -2px);[m
[32m+[m[32m    box-shadow: 6px 6px #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn:disabled {[m
[32m+[m[32m    opacity: 0.6;[m
[32m+[m[32m    cursor: not-allowed;[m
[32m+[m[32m    transform: none;[m
[32m+[m[32m    box-shadow: 2px 2px #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn-primary {[m
[32m+[m[32m    background-color: #4ade80;[m
[32m+[m[32m    color: #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn-primary:hover {[m
[32m+[m[32m    background-color: #22c55e;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-btn-secondary {[m
[32m+[m[32m    background-color: #60a5fa;[m
[32m+[m[32m    color: #000;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-no-invoices-message {[m
[32m+[m[32m    padding: 2rem;[m
[32m+[m[32m    background-color: #f9fafb;[m
[32m+[m[32m    border: 3px dashed #d1d5db;[m
[32m+[m[32m    text-align: center;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-loading-content,[m
[32m+[m[32m.neo-error-content {[m
[32m+[m[32m    display: flex;[m
[32m+[m[32m    align-items: center;[m
[32m+[m[32m    justify-content: center;[m
[32m+[m[32m    gap: 1rem;[m
[32m+[m[32m    padding: 2rem;[m
[32m+[m[32m    direction: rtl;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-payable-amount {[m
[32m+[m[32m    font-size: 1.25rem;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    color: #059669;[m
[32m+[m[32m    direction: rtl;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-official-invoice {[m
[32m+[m[32m    color: #dc2626 !important;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-unofficial-invoice {[m
[32m+[m[32m    color: #059669 !important;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-tax-badge {[m
[32m+[m[32m    background-color: #fef3c7;[m
[32m+[m[32m    color: #92400e;[m
[32m+[m[32m    padding: 4px 8px;[m
[32m+[m[32m    border-radius: 4px;[m
[32m+[m[32m    font-size: 0.9rem;[m
[32m+[m[32m    font-weight: bold;[m
[32m+[m[32m    margin-left: 8px;[m
[32m+[m[32m    border: 1px solid #f59e0b;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.neo-invoice-info-grid {[m
[32m+[m[32m    display: grid;[m
[32m+[m[32m    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));[m
[32m+[m[32m    gap: 1.5rem;[m
[32m+[m[32m    padding: 1.5rem;[m
[32m+[m[32m    direction: rtl;[m
 }[m
\ No newline at end of file[m
[1mdiff --git a/tasks/serializers/orders.py b/tasks/serializers/orders.py[m
[1mindex 60bdc5ab..aba94554 100644[m
[1m--- a/tasks/serializers/orders.py[m
[1m+++ b/tasks/serializers/orders.py[m
[36m@@ -2,7 +2,7 @@[m [mfrom rest_framework import serializers[m
 from django.db import transaction[m
 from django.utils import timezone[m
 from decimal import Decimal[m
[31m-from ..models import Order, OrderItem, Product, STATUS_CHOICES, Customer[m
[32m+[m[32mfrom ..models import Order, OrderItem, Product, STATUS_CHOICES, Customer, OrderPaymentReceipt[m
 from ..serializers.customers import CustomerInvoiceInfoUpdateSerializer[m
 [m
 class OrderItemCreateSerializer(serializers.Serializer):[m
[36m@@ -493,4 +493,27 @@[m [mclass OrderDetailSerializer(serializers.ModelSerializer):[m
         try:[m
             return obj.all_payment_receipts.count() if hasattr(obj, 'all_payment_receipts') else 0[m
         except:[m
[31m-            return 0[m
\ No newline at end of file[m
[32m+[m[32m            return 0[m
[32m+[m
[32m+[m
[32m+[m[32mclass PaymentReceiptSerializer(serializers.ModelSerializer):[m
[32m+[m[32m    file_url = serializers.SerializerMethodField()[m
[32m+[m[32m    download_url = serializers.SerializerMethodField()[m
[32m+[m
[32m+[m[32m    class Meta:[m
[32m+[m[32m        model = OrderPaymentReceipt[m
[32m+[m[32m        fields = ['id', 'file_name', 'file_size', 'file_type', 'uploaded_at',[m
[32m+[m[32m                  'is_verified', 'file_url', 'download_url', 'admin_notes'][m
[32m+[m
[32m+[m[32m    def get_file_url(self, obj):[m
[32m+[m[32m        """Return direct media URL without authentication"""[m
[32m+[m[32m        if obj.receipt_file:[m
[32m+[m[32m            request = self.context.get('request')[m
[32m+[m[32m            if request:[m
[32m+[m[32m                return request.build_absolute_uri(obj.receipt_file.url)[m
[32m+[m[32m            return obj.receipt_file.url[m
[32m+[m[32m        return None[m
[32m+[m
[32m+[m[32m    def get_download_url(self, obj):[m
[32m+[m[32m        """Return the same URL as file_url for direct download"""[m
[32m+[m[32m        return self.get_file_url(obj)[m
\ No newline at end of file[m
[1mdiff --git a/tasks/serializers/products.py b/tasks/serializers/products.py[m
[1mindex f85ad967..170a5204 100644[m
[1m--- a/tasks/serializers/products.py[m
[1m+++ b/tasks/serializers/products.py[m
[36m@@ -211,7 +211,7 @@[m [mclass ShipmentAnnouncementSerializer(serializers.ModelSerializer):[m
         return None[m
 [m
     def get_images(self, obj):[m
[31m-        """Return all images in the format frontend expects"""[m
[32m+[m[32m        """Return all images in the format frontend expects - FIXED to use 'additional_images'"""[m
         request = self.context.get('request')[m
         images = [][m
 [m
[36m@@ -222,7 +222,7 @@[m [mclass ShipmentAnnouncementSerializer(serializers.ModelSerializer):[m
                 image_url = request.build_absolute_uri(image_url)[m
             images.append({'image': image_url})[m
 [m
[31m-        # FIXED: Use the correct related name 'additional_images'[m
[32m+[m[32m        # FIXED: Use the correct related name 'additional_images' (not 'images')[m
         additional_images = obj.additional_images.all().order_by('order')[m
 [m
         for img in additional_images:[m
[1mdiff --git a/tasks/views/admin.py b/tasks/views/admin.py[m
[1mindex a9cf4d6d..1b3c8def 100644[m
[1m--- a/tasks/views/admin.py[m
[1m+++ b/tasks/views/admin.py[m
[36m@@ -936,28 +936,24 @@[m [mclass AdminDealerViewSet(viewsets.ModelViewSet):[m
 [m
 [m
 class AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
[31m-    """Admin shipment announcement management with email notifications"""[m
[32m+[m[32m    """Admin-specific ViewSet for shipment announcements with proper field names"""[m
     authentication_classes = [JWTAuthentication][m
     permission_classes = [IsAdminUser][m
     serializer_class = ShipmentAnnouncementSerializer[m
 [m
     def get_queryset(self):[m
[31m-        return ShipmentAnnouncement.objects.all().select_related('created_by').prefetch_related('images').order_by([m
[32m+[m[32m        """FIXED: Use correct prefetch_related with 'additional_images'"""[m
[32m+[m[32m        return ShipmentAnnouncement.objects.select_related('created_by').prefetch_related('additional_images').order_by([m
             '-created_at')[m
 [m
     def create(self, request, *args, **kwargs):[m
[31m-        """Create announcement with email notifications"""[m
[31m-        if not request.user.is_staff:[m
[31m-            return Response({[m
[31m-                'error': 'Permission denied. Admin access required.'[m
[31m-            }, status=status.HTTP_403_FORBIDDEN)[m
[31m-[m
[32m+[m[32m        """Create announcement with file upload support"""[m
         try:[m
             # Extract and validate images[m
             images = request.FILES.getlist('images')[m
 [m
[31m-            # Validate images files[m
[31m-            allowed_types = ['images/jpeg', 'images/jpg', 'images/png', 'images/gif', 'images/webp'][m
[32m+[m[32m            # Validate image files[m
[32m+[m[32m            allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'][m
             max_size = 5 * 1024 * 1024  # 5MB[m
 [m
             for image in images:[m
[36m@@ -974,8 +970,6 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
             # Convert boolean strings to actual booleans[m
             is_active = str(request.data.get('is_active', 'true')).lower() in ['true', '1', 'yes'][m
             is_featured = str(request.data.get('is_featured', 'false')).lower() in ['true', '1', 'yes'][m
[31m-            send_email_notifications = str(request.data.get('send_email_notifications', 'true')).lower() in ['true',[m
[31m-                                                                                                             '1', 'yes'][m
 [m
             # Clean up date fields[m
             shipment_date = request.data.get('shipment_date')[m
[36m@@ -1015,12 +1009,11 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
 [m
             # Handle images if provided[m
             if images:[m
[31m-                # Set first images as main images[m
[32m+[m[32m                # Set first image as main image[m
                 announcement.image = images[0][m
                 announcement.save()[m
 [m
[31m-                # Handle additional images (if more than 1 images uploaded)[m
[31m-                from ..models import ShipmentAnnouncementImage[m
[32m+[m[32m                # FIXED: Handle additional images using correct model and field names[m
                 for i, image_file in enumerate(images[1:], start=1):[m
                     ShipmentAnnouncementImage.objects.create([m
                         announcement=announcement,[m
[36m@@ -1029,64 +1022,30 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
                         alt_text=f"Image {i + 1} for {announcement.title}"[m
                     )[m
 [m
[31m-            # NEW: Send email notifications if requested[m
[31m-            email_results = {}[m
[31m-            if send_email_notifications and is_active:[m
[31m-                print(f"📧 Sending new arrival notifications for announcement: {announcement.title}")[m
[31m-[m
[31m-                # Send to customers[m
[31m-                customer_count = NotificationService.notify_all_customers_new_arrival(announcement)[m
[31m-                email_results['customers_notified'] = customer_count[m
[31m-[m
[31m-                # Send to dealers[m
[31m-                dealer_count = NotificationService.notify_dealers_new_arrival(announcement)[m
[31m-                email_results['dealers_notified'] = dealer_count[m
[31m-[m
[31m-                print(f"✅ Email notifications sent: {customer_count} customers, {dealer_count} dealers")[m
[31m-            else:[m
[31m-                email_results = {[m
[31m-                    'customers_notified': 0,[m
[31m-                    'dealers_notified': 0,[m
[31m-                    'reason': 'Email notifications disabled or announcement inactive'[m
[31m-                }[m
[31m-[m
             # Return success response using the serializer for output only[m
             serializer = self.get_serializer(announcement)[m
             return Response({[m
                 'message': 'Announcement created successfully',[m
[31m-                'announcement': serializer.data,[m
[31m-                'email_notifications': email_results[m
[32m+[m[32m                'announcement': serializer.data[m
             }, status=status.HTTP_201_CREATED)[m
 [m
         except Exception as e:[m
[31m-            print(f"❌ Error creating announcement: {str(e)}")[m
             return Response({[m
                 'error': f'خطا در ایجاد اطلاعیه: {str(e)}'[m
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
     def update(self, request, *args, **kwargs):[m
[31m-        """Update announcement with optional email notifications"""[m
[31m-        if not request.user.is_staff:[m
[31m-            return Response({[m
[31m-                'error': 'Permission denied. Admin access required.'[m
[31m-            }, status=status.HTTP_403_FORBIDDEN)[m
[31m-[m
[32m+[m[32m        """Update announcement with file upload support"""[m
         try:[m
             partial = kwargs.pop('partial', False)[m
             instance = self.get_object()[m
 [m
[31m-            # Check if this is an activation update[m
[31m-            old_is_active = instance.is_active[m
[31m-            send_email_notifications = str(request.data.get('send_email_notifications', 'false')).lower() in ['true',[m
[31m-                                                                                                              '1',[m
[31m-                                                                                                              'yes'][m
[31m-[m
             # Extract and validate images if provided[m
             images = request.FILES.getlist('images')[m
 [m
             if images:[m
[31m-                # Validate images files[m
[31m-                allowed_types = ['images/jpeg', 'images/jpg', 'images/png', 'images/gif', 'images/webp'][m
[32m+[m[32m                # Validate image files[m
[32m+[m[32m                allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'][m
                 max_size = 5 * 1024 * 1024  # 5MB[m
 [m
                 for image in images:[m
[36m@@ -1140,17 +1099,16 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
             # Save the updated instance[m
             instance.save()[m
 [m
[31m-            # Handle images updates if new images provided[m
[32m+[m[32m            # Handle image updates if new images provided[m
             if images:[m
[31m-                # Clear existing additional images[m
[31m-                instance.images.all().delete()[m
[32m+[m[32m                # FIXED: Clear existing additional images using correct related name[m
[32m+[m[32m                instance.additional_images.all().delete()[m
 [m
[31m-                # Set first images as main images[m
[32m+[m[32m                # Set first image as main image[m
                 instance.image = images[0][m
                 instance.save()[m
 [m
[31m-                # Add additional images[m
[31m-                from ..models import ShipmentAnnouncementImage[m
[32m+[m[32m                # FIXED: Add additional images using correct model and field names[m
                 for i, image_file in enumerate(images[1:], start=1):[m
                     ShipmentAnnouncementImage.objects.create([m
                         announcement=instance,[m
[36m@@ -1159,129 +1117,63 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
                         alt_text=f"Image {i + 1} for {instance.title}"[m
                     )[m
 [m
[31m-            # NEW: Send email notifications if announcement was just activated[m
[31m-            email_results = {}[m
[31m-            if send_email_notifications and not old_is_active and instance.is_active:[m
[31m-                print(f"📧 Sending activation notifications for announcement: {instance.title}")[m
[31m-[m
[31m-                # Send to customers[m
[31m-                customer_count = NotificationService.notify_all_customers_new_arrival(instance)[m
[31m-                email_results['customers_notified'] = customer_count[m
[31m-[m
[31m-                # Send to dealers[m
[31m-                dealer_count = NotificationService.notify_dealers_new_arrival(instance)[m
[31m-                email_results['dealers_notified'] = dealer_count[m
[31m-[m
[31m-                print(f"✅ Activation email notifications sent: {customer_count} customers, {dealer_count} dealers")[m
[31m-            else:[m
[31m-                email_results = {[m
[31m-                    'customers_notified': 0,[m
[31m-                    'dealers_notified': 0,[m
[31m-                    'reason': 'Email notifications not requested or announcement was already active'[m
[31m-                }[m
[31m-[m
             # Return success response using the serializer for output only[m
             serializer = self.get_serializer(instance)[m
             return Response({[m
                 'message': 'Announcement updated successfully',[m
[31m-                'announcement': serializer.data,[m
[31m-                'email_notifications': email_results[m
[32m+[m[32m                'announcement': serializer.data[m
             }, status=status.HTTP_200_OK)[m
 [m
         except Exception as e:[m
[31m-            print(f"❌ Error updating announcement: {str(e)}")[m
             return Response({[m
                 'error': f'خطا در به‌روزرسانی اطلاعیه: {str(e)}'[m
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
[31m-    @action(detail=True, methods=['POST'], url_path='send-notifications')[m
[31m-    def send_notifications(self, request, pk=None):[m
[31m-        """Manually send email notifications for an existing announcement"""[m
[31m-        if not request.user.is_staff:[m
[31m-            return Response({[m
[31m-                'error': 'Permission denied. Admin access required.'[m
[31m-            }, status=status.HTTP_403_FORBIDDEN)[m
[31m-[m
[31m-        try:[m
[31m-            announcement = self.get_object()[m
[31m-[m
[31m-            if not announcement.is_active:[m
[31m-                return Response({[m
[31m-                    'error': 'Cannot send notifications for inactive announcement'[m
[31m-                }, status=status.HTTP_400_BAD_REQUEST)[m
[31m-[m
[31m-            print(f"📧 Manually sending notifications for announcement: {announcement.title}")[m
[31m-[m
[31m-            # Send to customers[m
[31m-            customer_count = NotificationService.notify_all_customers_new_arrival(announcement)[m
[31m-[m
[31m-            # Send to dealers[m
[31m-            dealer_count = NotificationService.notify_dealers_new_arrival(announcement)[m
[31m-[m
[31m-            return Response({[m
[31m-                'message': 'Email notifications sent successfully',[m
[31m-                'results': {[m
[31m-                    'customers_notified': customer_count,[m
[31m-                    'dealers_notified': dealer_count,[m
[31m-                    'total_sent': customer_count + dealer_count[m
[31m-                }[m
[31m-            })[m
[31m-[m
[31m-        except Exception as e:[m
[31m-            return Response({[m
[31m-                'error': f'Failed to send notifications: {str(e)}'[m
[31m-            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
[32m+[m[32m    def list(self, request, *args, **kwargs):[m
[32m+[m[32m        """List all announcements for admin"""[m
[32m+[m[32m        announcements = self.get_queryset()[m
[32m+[m[32m        serializer = self.get_serializer(announcements, many=True)[m
[32m+[m[32m        return Response(serializer.data)[m
 [m
     @action(detail=False, methods=['POST'], url_path='bulk-action')[m
     def bulk_action(self, request):[m
         """Perform bulk actions on announcements"""[m
[31m-        try:[m
[31m-            announcement_ids = request.data.get('announcement_ids', [])[m
[31m-            action = request.data.get('action')[m
[31m-[m
[31m-            if not announcement_ids:[m
[31m-                return Response({[m
[31m-                    'error': 'No announcements selected'[m
[31m-                }, status=status.HTTP_400_BAD_REQUEST)[m
[31m-[m
[31m-            announcements = ShipmentAnnouncement.objects.filter(id__in=announcement_ids)[m
[32m+[m[32m        action = request.data.get('action')[m
[32m+[m[32m        announcement_ids = request.data.get('announcement_ids', [])[m
 [m
[31m-            if not announcements.exists():[m
[31m-                return Response({[m
[31m-                    'error': 'No announcements found'[m
[31m-                }, status=status.HTTP_404_NOT_FOUND)[m
[32m+[m[32m        if not action or not announcement_ids:[m
[32m+[m[32m            return Response({[m
[32m+[m[32m                'error': 'Action and announcement_ids are required'[m
[32m+[m[32m            }, status=status.HTTP_400_BAD_REQUEST)[m
 [m
[31m-            updated_count = 0[m
[32m+[m[32m        announcements = ShipmentAnnouncement.objects.filter(id__in=announcement_ids)[m
[32m+[m[32m        if not announcements.exists():[m
[32m+[m[32m            return Response({[m
[32m+[m[32m                'error': 'No announcements found with provided IDs'[m
[32m+[m[32m            }, status=status.HTTP_404_NOT_FOUND)[m
 [m
[32m+[m[32m        updated_count = 0[m
[32m+[m[32m        try:[m
             if action == 'activate':[m
                 updated_count = announcements.update(is_active=True)[m
[31m-                message = f'{updated_count} announcements activated'[m
             elif action == 'deactivate':[m
                 updated_count = announcements.update(is_active=False)[m
[31m-                message = f'{updated_count} announcements deactivated'[m
[31m-            elif action == 'feature':[m
[31m-                updated_count = announcements.update(is_featured=True)[m
[31m-                message = f'{updated_count} announcements featured'[m
[31m-            elif action == 'unfeature':[m
[31m-                updated_count = announcements.update(is_featured=False)[m
[31m-                message = f'{updated_count} announcements unfeatured'[m
             elif action == 'delete':[m
                 updated_count = announcements.count()[m
                 announcements.delete()[m
[31m-                message = f'{updated_count} announcements deleted'[m
             else:[m
                 return Response({[m
[31m-                    'error': 'Invalid action'[m
[32m+[m[32m                    'error': f'Unknown action: {action}'[m
                 }, status=status.HTTP_400_BAD_REQUEST)[m
 [m
             return Response({[m
[31m-                'message': message,[m
[32m+[m[32m                'message': f'Bulk {action} completed successfully',[m
                 'updated_count': updated_count[m
             })[m
 [m
         except Exception as e:[m
             return Response({[m
[31m-                'error': f'Bulk action failed: {str(e)}'[m
[32m+[m[32m                'error': f'Error performing bulk action: {str(e)}'[m
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
     @action(detail=False, methods=['GET'], url_path='analytics')[m
[36m@@ -1293,38 +1185,29 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
             # Basic stats[m
             total = announcements.count()[m
             active = announcements.filter(is_active=True).count()[m
[32m+[m[32m            inactive = announcements.filter(is_active=False).count()[m
             featured = announcements.filter(is_featured=True).count()[m
 [m
[31m-            # Recent stats[m
[31m-            week_ago = timezone.now() - timedelta(days=7)[m
[31m-            month_ago = timezone.now() - timedelta(days=30)[m
[32m+[m[32m            # This month stats[m
[32m+[m[32m            from datetime import datetime[m
[32m+[m[32m            now = datetime.now()[m
[32m+[m[32m            this_month = announcements.filter([m
[32m+[m[32m                created_at__year=now.year,[m
[32m+[m[32m                created_at__month=now.month[m
[32m+[m[32m            ).count()[m
 [m
[31m-            recent_week = announcements.filter(created_at__gte=week_ago).count()[m
[31m-            recent_month = announcements.filter(created_at__gte=month_ago).count()[m
[31m-[m
[31m-            # Most recent announcements[m
[31m-            recent_announcements = announcements[:5][m
[31m-            recent_data = [][m
[31m-            for ann in recent_announcements:[m
[31m-                recent_data.append({[m
[31m-                    'id': ann.id,[m
[31m-                    'title': ann.title,[m
[31m-                    'created_at': ann.created_at.isoformat(),[m
[31m-                    'is_active': ann.is_active,[m
[31m-                    'is_featured': ann.is_featured,[m
[31m-                    'created_by': ann.created_by.name if ann.created_by else 'Unknown'[m
[31m-                })[m
[32m+[m[32m            # Total views[m
[32m+[m[32m            total_views = announcements.aggregate([m
[32m+[m[32m                total=Sum('view_count')[m
[32m+[m[32m            )['total'] or 0[m
 [m
             return Response({[m
[31m-                'stats': {[m
[31m-                    'total': total,[m
[31m-                    'active': active,[m
[31m-                    'inactive': total - active,[m
[31m-                    'featured': featured,[m
[31m-                    'recent_week': recent_week,[m
[31m-                    'recent_month': recent_month[m
[31m-                },[m
[31m-                'recent_announcements': recent_data[m
[32m+[m[32m                'total': total,[m
[32m+[m[32m                'active': active,[m
[32m+[m[32m                'inactive': inactive,[m
[32m+[m[32m                'featured': featured,[m
[32m+[m[32m                'this_month': this_month,[m
[32m+[m[32m                'total_views': total_views[m
             })[m
 [m
         except Exception as e:[m
[36m@@ -1332,7 +1215,6 @@[m [mclass AdminAnnouncementViewSet(viewsets.ModelViewSet):[m
                 'error': f'Analytics failed: {str(e)}'[m
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
[31m-[m
 class AdminReportsViewSet(viewsets.ViewSet):[m
     """Admin reports and analytics"""[m
     authentication_classes = [JWTAuthentication][m
[1mdiff --git a/tasks/views/orders.py b/tasks/views/orders.py[m
[1mindex 428f8cb7..a727da7b 100644[m
[1m--- a/tasks/views/orders.py[m
[1m+++ b/tasks/views/orders.py[m
[36m@@ -655,7 +655,7 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
 [m
     @action(detail=True, methods=['POST'], url_path='upload-payment-receipt')[m
     def upload_payment_receipt(self, request, *args, **kwargs):[m
[31m-        """Customer uploads multiple payment receipts (images and PDFs)"""[m
[32m+[m[32m        """Customer uploads multiple payment receipts (images and PDFs) - FIXED VERSION"""[m
         try:[m
             order = self.get_object()[m
 [m
[36m@@ -670,7 +670,7 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
                 }, status=status.HTTP_400_BAD_REQUEST)[m
 [m
             # Get multiple files[m
[31m-            uploaded_files = request.FILES.getlist('payment_receipts')  # Changed from single to multiple[m
[32m+[m[32m            uploaded_files = request.FILES.getlist('payment_receipts')[m
 [m
             if not uploaded_files:[m
                 return Response({[m
[36m@@ -683,9 +683,8 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
             allowed_types = allowed_image_types + allowed_pdf_types[m
 [m
             max_file_size = 15 * 1024 * 1024  # 15MB[m
[31m-            max_files_count = 10  # Maximum 10 files per upload[m
[32m+[m[32m            max_files_count = 10[m
 [m
[31m-            # Validate file count[m
             if len(uploaded_files) > max_files_count:[m
                 return Response({[m
                     'error': f'Maximum {max_files_count} files allowed per upload'[m
[36m@@ -698,16 +697,12 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
             for i, file in enumerate(uploaded_files):[m
                 file_errors = [][m
 [m
[31m-                # Check file type[m
                 if file.content_type not in allowed_types:[m
[31m-                    file_errors.append([m
[31m-                        f'File {i + 1} ({file.name}): Unsupported format. Only images (JPEG, PNG, GIF, WebP) and PDF are allowed')[m
[32m+[m[32m                    file_errors.append(f'File {i + 1} ({file.name}): Unsupported format')[m
 [m
[31m-                # Check file size[m
                 if file.size > max_file_size:[m
                     file_errors.append(f'File {i + 1} ({file.name}): Size exceeds 15MB limit')[m
 [m
[31m-                # Check if file is empty[m
                 if file.size == 0:[m
                     file_errors.append(f'File {i + 1} ({file.name}): File is empty')[m
 [m
[36m@@ -725,28 +720,43 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
                     'details': errors[m
                 }, status=status.HTTP_400_BAD_REQUEST)[m
 [m
[31m-            # Save valid files[m
[32m+[m[32m            # Save valid files with proper error handling[m
             saved_receipts = [][m
             from ..models import OrderPaymentReceipt[m
[32m+[m[32m            import os[m
[32m+[m[32m            from django.conf import settings[m
 [m
             for file, file_type in valid_files:[m
                 try:[m
[31m-                    receipt = OrderPaymentReceipt.objects.create([m
[32m+[m[32m                    # Create the receipt record[m
[32m+[m[32m                    receipt = OrderPaymentReceipt([m
                         order=order,[m
[31m-                        receipt_file=file,[m
                         file_type=file_type,[m
                         uploaded_by=request.user[m
                     )[m
[31m-                    saved_receipts.append({[m
[31m-                        'id': receipt.id,[m
[31m-                        'file_name': receipt.file_name,[m
[31m-                        'file_type': receipt.file_type,[m
[31m-                        'file_size': receipt.file_size,[m
[31m-                        'uploaded_at': receipt.uploaded_at,[m
[31m-                        'file_url': receipt.receipt_file.url if receipt.receipt_file else None[m
[31m-                    })[m
[32m+[m
[32m+[m[32m                    # Save the file[m
[32m+[m[32m                    receipt.receipt_file.save(file.name, file, save=True)[m
[32m+[m
[32m+[m[32m                    # Verify file was saved[m
[32m+[m[32m                    if receipt.receipt_file and os.path.exists(receipt.receipt_file.path):[m
[32m+[m[32m                        logger.info(f"✅ File saved successfully: {receipt.receipt_file.path}")[m
[32m+[m
[32m+[m[32m                        saved_receipts.append({[m
[32m+[m[32m                            'id': receipt.id,[m
[32m+[m[32m                            'file_name': receipt.file_name,[m
[32m+[m[32m                            'file_type': receipt.file_type,[m
[32m+[m[32m                            'file_size': receipt.file_size,[m
[32m+[m[32m                            'uploaded_at': receipt.uploaded_at,[m
[32m+[m[32m                            'file_url': request.build_absolute_uri(receipt.receipt_file.url)[m
[32m+[m[32m                        })[m
[32m+[m[32m                    else:[m
[32m+[m[32m                        logger.error(f"❌ File not found after save: {file.name}")[m
[32m+[m[32m                        receipt.delete()  # Clean up the database record[m
[32m+[m[32m                        errors.append(f'Failed to save {file.name}: File not found after upload')[m
[32m+[m
                 except Exception as e:[m
[31m-                    logger.error(f"Error saving receipt file {file.name}: {str(e)}")[m
[32m+[m[32m                    logger.error(f"❌ Error saving receipt file {file.name}: {str(e)}")[m
                     errors.append(f'Failed to save {file.name}: {str(e)}')[m
 [m
             # Update order status if we have successfully saved receipts[m
[36m@@ -791,7 +801,7 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
 [m
     @action(detail=True, methods=['GET'], url_path='payment-receipts')[m
     def get_payment_receipts(self, request, *args, **kwargs):[m
[31m-        """Get all payment receipts for an order"""[m
[32m+[m[32m        """Get all payment receipts for an order with DIRECT media URLs"""[m
         try:[m
             order = self.get_object()[m
 [m
[36m@@ -805,6 +815,18 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
             receipts_data = [][m
 [m
             for receipt in receipts:[m
[32m+[m[32m                # Build the file URL properly[m
[32m+[m[32m                file_url = None[m
[32m+[m[32m                download_url = None[m
[32m+[m
[32m+[m[32m                if receipt.receipt_file:[m
[32m+[m[32m                    try:[m
[32m+[m[32m                        # Get the direct media URL[m
[32m+[m[32m                        file_url = request.build_absolute_uri(receipt.receipt_file.url)[m
[32m+[m[32m                        download_url = file_url[m
[32m+[m[32m                    except (ValueError, AttributeError) as e:[m
[32m+[m[32m                        logger.warning(f"Could not generate URL for receipt {receipt.id}: {e}")[m
[32m+[m
                 receipts_data.append({[m
                     'id': receipt.id,[m
                     'file_name': receipt.file_name,[m
[36m@@ -814,7 +836,9 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
                     'uploaded_by': receipt.uploaded_by.name,[m
                     'is_verified': receipt.is_verified,[m
                     'admin_notes': receipt.admin_notes,[m
[31m-                    'file_url': receipt.receipt_file.url if receipt.receipt_file else None[m
[32m+[m[32m                    # FIXED: Direct media URLs - no authentication needed[m
[32m+[m[32m                    'file_url': file_url,[m
[32m+[m[32m                    'download_url': download_url[m
                 })[m
 [m
             return Response({[m
[36m@@ -955,47 +979,7 @@[m [mclass OrderViewSet(viewsets.ModelViewSet):[m
                 'error': f'Payment verification failed: {str(e)}'[m
             }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
[31m-    @action(detail=True, methods=['GET'], url_path='payment-receipts')[m
[31m-    def get_payment_receipts(self, request, *args, **kwargs):[m
[31m-        try:[m
[31m-            order = self.get_object()[m
 [m
[31m-            # Permission check[m
[31m-            if not (request.user.is_staff or request.user == order.customer or request.user == order.assigned_dealer):[m
[31m-                return Response({[m
[31m-                    'error': 'Permission denied'[m
[31m-                }, status=status.HTTP_403_FORBIDDEN)[m
[31m-[m
[31m-            receipts = order.all_payment_receipts[m
[31m-            receipts_data = [][m
[31m-[m
[31m-            for receipt in receipts:[m
[31m-                base_url = request.build_absolute_uri('/')[:-1]  # Remove trailing slash[m
[31m-[m
[31m-                receipts_data.append({[m
[31m-                    'id': receipt.id,[m
[31m-                    'file_name': receipt.file_name,[m
[31m-                    'file_type': receipt.file_type,[m
[31m-                    'file_size': receipt.file_size,[m
[31m-                    'uploaded_at': receipt.uploaded_at,[m
[31m-                    'uploaded_by': receipt.uploaded_by.name,[m
[31m-                    'is_verified': receipt.is_verified,[m
[31m-                    'admin_notes': receipt.admin_notes,[m
[31m-                    'file_url': f"{base_url}/api/receipts/{receipt.id}/view/",[m
[31m-                    'download_url': f"{base_url}/api/receipts/{receipt.id}/download/"[m
[31m-                })[m
[31m-[m
[31m-            return Response({[m
[31m-                'order_id': order.id,[m
[31m-                'total_receipts': len(receipts_data),[m
[31m-                'receipts': receipts_data[m
[31m-            })[m
[31m-[m
[31m-        except Exception as e:[m
[31m-            logger.error(f"❌ Error getting payment receipts: {str(e)}")[m
[31m-            return Response({[m
[31m-                'error': 'Failed to retrieve payment receipts'[m
[31m-            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)[m
 [m
     @action(detail=False, methods=['GET'], url_path='dealer-dashboard-stats')[m
     def dealer_dashboard_stats(self, request):[m
[1mdiff --git a/tasks/views/products.py b/tasks/views/products.py[m
[1mindex 9b8974d4..b29ee2de 100644[m
[1m--- a/tasks/views/products.py[m
[1m+++ b/tasks/views/products.py[m
[36m@@ -436,7 +436,7 @@[m [mclass ProductViewSet(viewsets.ModelViewSet):[m
 [m
 [m
 class ShipmentAnnouncementViewSet(viewsets.ModelViewSet):[m
[31m-    """Clean ViewSet for shipment announcements"""[m
[32m+[m[32m    """Fixed ViewSet for shipment announcements"""[m
     authentication_classes = [JWTAuthentication][m
     serializer_class = ShipmentAnnouncementSerializer[m
 [m
[36m@@ -448,12 +448,13 @@[m [mclass ShipmentAnnouncementViewSet(viewsets.ModelViewSet):[m
         return [permission() for permission in permission_classes][m
 [m
     def get_queryset(self):[m
[32m+[m[32m        """FIXED: Use correct prefetch_related"""[m
         if self.request.user.is_staff:[m
[31m-            return ShipmentAnnouncement.objects.all().order_by('-created_at')[m
[32m+[m[32m            return ShipmentAnnouncement.objects.select_related('created_by').prefetch_related('additional_images').order_by('-created_at')[m
         else:[m
             return ShipmentAnnouncement.objects.filter([m
                 is_active=True[m
[31m-            ).order_by('-is_featured', '-created_at')[m
[32m+[m[32m            ).select_related('created_by').prefetch_related('additional_images').order_by('-is_featured', '-created_at')[m
 [m
     def create(self, request, *args, **kwargs):[m
         """Create announcement without using DRF serializer for files"""[m
[36m@@ -527,7 +528,7 @@[m [mclass ShipmentAnnouncementViewSet(viewsets.ModelViewSet):[m
                 announcement.image = images[0][m
                 announcement.save()[m
 [m
[31m-                # Handle additional images (if more than 1 image uploaded)[m
[32m+[m[32m                # FIXED: Handle additional images using correct model[m
                 from ..models import ShipmentAnnouncementImage[m
                 for i, image_file in enumerate(images[1:], start=1):[m
                     ShipmentAnnouncementImage.objects.create([m
[36m@@ -621,14 +622,14 @@[m [mclass ShipmentAnnouncementViewSet(viewsets.ModelViewSet):[m
 [m
             # Handle image updates if new images provided[m
             if images:[m
[31m-                # Clear existing additional images[m
[31m-                instance.images.all().delete()[m
[32m+[m[32m                # FIXED: Clear existing additional images using correct related name[m
[32m+[m[32m                instance.additional_images.all().delete()[m
 [m
                 # Set first image as main image[m
                 instance.image = images[0][m
                 instance.save()[m
 [m
[31m-                # Add additional images[m
[32m+[m[32m                # FIXED: Add additional images using correct model[m
                 from ..models import ShipmentAnnouncementImage[m
                 for i, image_file in enumerate(images[1:], start=1):[m
                     ShipmentAnnouncementImage.objects.create([m
