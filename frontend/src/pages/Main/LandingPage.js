// Create this as: frontend/src/pages/Main/LandingPage.js

import React, { useState, useEffect } from 'react';
import '../../styles/Main/LandingPage.css'

const LandingPage = ({ onEnterSite }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(true);
    }, []);

    const handleEnterSite = () => {
        if (onEnterSite) {
            onEnterSite();
        } else {
            window.location.href = '/main';
        }
    };

    const importCountries = [
        'ترکیه', 'هند', 'چین', 'تایلند', 'ویتنام', 'اندونزی', 'برزیل', 'کلمبیا', 'پرو', 'اتیوپی',
        'کنیا', 'اوگاندا', 'آفریقای جنوبی', 'مغرب', 'تونس', 'مصر', 'سوریه', 'لبنان', 'اردن',
        'عراق', 'پاکستان', 'بنگلادش', 'سری‌لانکا', 'نپال', 'میانمار', 'لائوس', 'کامبوج', 'فیلیپین',
        'مالزی', 'سنگاپور', 'استرالیا', 'نیوزلند', 'آرژانتین', 'شیلی', 'اکوادور', 'بولیوی'
    ];

    const products = [
        { category: 'ادویه‌جات', items: ['زعفران', 'زردچوبه', 'دارچین', 'هل', 'فلفل سیاه', 'زیره', 'گشنیز', 'خردل'] },
        { category: 'آجیل', items: ['بادام', 'گردو', 'فندق', 'پسته', 'کشمش', 'خرما', 'انجیر خشک', 'آلو خشک'] },
        { category: 'دانه‌ها', items: ['تخم آفتابگردان', 'تخم کدو', 'کنجد', 'نخود', 'لوبیا', 'عدس', 'برنج', 'جو'] },
        { category: 'محصولات قنادی', items: ['شکلات', 'کاکائو', 'کره کاکائو', 'پودر کاکائو', 'نارگیل خشک', 'وانیل'] },
        { category: 'قهوه', items: ['قهوه عربیکا', 'قهوه روبوستا', 'قهوه سبز', 'قهوه برشته', 'قهوه فوری', 'اسپرسو'] }
    ];

    const exportProducts = [
        { name: 'پسته ایرانی', description: 'بهترین کیفیت پسته از باغات کرمان' },
        { name: 'کشمش', description: 'کشمش آفتابی و سایه‌ای از تاکستان‌های ایران' },
        { name: 'زعفران', description: 'زعفران درجه یک خراسان با کیفیت صادراتی' }
    ];

    return (
        <div className="landing-page" dir="rtl">
            {/* Header */}
            <header className="landing-header">
                <div className="container">
                    <div className="header-content">
                        <div className="logo-section">
                            <div className="logo">
                                <img
                                    src="/images/company_logo.svg"
                                    alt="شرکت کیان تجارت پویا کویر"
                                    className="logo-image"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        const logoText = e.target.parentElement.querySelector('.logo-text');
                                        if (logoText) {
                                            logoText.style.display = 'flex';
                                        }
                                    }}
                                />
                                <span className="logo-text" style={{display: 'none'}}>GTC</span>
                            </div>
                            <div className="company-info">
                                <h1>شرکت تولیدی بازرگانی گلمحمدی</h1>
                                <p>کیان تجارت پویا کویر</p>
                            </div>
                        </div>
                        <div className="contact-section">
                            <div className="contact-info">
                                <p className="phone-main">۰۳۵-۹۱۰۰۷۷۱۱</p>
                                <p className="phone-mobile">۰۹۹۸۹۱۲۱۲۱۰۷۷۰</p>
                            </div>
                            <button onClick={handleEnterSite} className="enter-site-btn">
                                ورود به سایت
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className={`hero-section ${isVisible ? 'visible' : ''}`}>
                <div className="container">
                    <h2 className="hero-title">تأمین‌کننده عمده محصولات کشاورزی</h2>
                    <p className="hero-description">
                        با بیش از ۱۰ سال تجربه در واردات و صادرات، ما بهترین محصولات کشاورزی را از
                        <span className="highlight"> ۳۵ کشور </span>
                        جهان وارد کرده و محصولات ایرانی باکیفیت را به سراسر دنیا صادر می‌کنیم
                    </p>

                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-icon">🌍</div>
                            <h3>۳۵ کشور</h3>
                            <p>شبکه وسیع تأمین‌کنندگان بین‌المللی</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">📦</div>
                            <h3>+۷۰ محصول</h3>
                            <p>تنوع بالا در محصولات کشاورزی</p>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">🏢</div>
                            <h3>عمده‌فروشی</h3>
                            <p>تأمین نیازهای صنایع غذایی</p>
                        </div>
                    </div>

                    <div className="cta-section">
                        <button onClick={handleEnterSite} className="main-cta-btn">
                            🚀 ورود به سیستم سفارش‌گیری
                        </button>
                        <p className="cta-description">دسترسی به پنل مشتریان، ثبت سفارش و پیگیری محموله‌ها</p>
                    </div>
                </div>
            </section>

            {/* Import Section */}
            <section className="import-section">
                <div className="container">
                    <h2 className="section-title">محصولات وارداتی ما</h2>

                    <div className="import-content">
                        <div className="products-grid">
                            {products.map((category, index) => (
                                <div key={index} className="product-category">
                                    <h3>{category.category}</h3>
                                    <div className="product-list">
                                        {category.items.slice(0, 4).map((item, i) => (
                                            <div key={i} className="product-item">
                                                <div className="bullet"></div>
                                                <span>{item}</span>
                                            </div>
                                        ))}
                                        {category.items.length > 4 && (
                                            <p className="more-items">و {category.items.length - 4} محصول دیگر...</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="countries-section">
                            <h3>کشورهای تأمین‌کننده</h3>
                            <div className="countries-grid">
                                {importCountries.slice(0, 20).map((country, index) => (
                                    <div key={index} className="country-item">
                                        <span className="country-icon">🌍</span>
                                        <span>{country}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="more-countries">و ۱۵ کشور دیگر...</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Export Section */}
            <section className="export-section">
                <div className="container">
                    <h2 className="section-title">محصولات صادراتی ما</h2>

                    <div className="export-grid">
                        {exportProducts.map((product, index) => (
                            <div key={index} className="export-card">
                                <h3>{product.name}</h3>
                                <p>{product.description}</p>
                                <span className="quality-badge">کیفیت صادراتی</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Company Info Section */}
            <section className="company-info-section">
                <div className="container">
                    <div className="info-grid">
                        <div className="info-card">
                            <h3>اطلاعات شرکت</h3>
                            <div className="info-list">
                                <div className="info-item">
                                    <span className="label">نام شرکت:</span>
                                    <span className="value">شرکت تولیدی بازرگانی گلمحمدی</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">نام تجاری:</span>
                                    <span className="value">کیان تجارت پویا کویر</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">شناسه اقتصادی:</span>
                                    <span className="value">۴۱۱۵۵۹۹۵۶۵۴۴</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">شناسه ملی:</span>
                                    <span className="value">۱۴۰۰۶۹۸۲۵۸۴</span>
                                </div>
                                <div className="info-item">
                                    <span className="label">کد پستی:</span>
                                    <span className="value">۸۹۱۶۸۴۵۸۴۶</span>
                                </div>
                            </div>
                        </div>

                        <div className="info-card">
                            <h3>اطلاعات تماس</h3>
                            <div className="contact-list">
                                <div className="contact-item">
                                    <div className="contact-icon">📍</div>
                                    <div>
                                        <p className="contact-label">آدرس:</p>
                                        <p className="contact-value">یزد، بلوار مدرس شماره ۱۳</p>
                                    </div>
                                </div>
                                <div className="contact-item">
                                    <div className="contact-icon">📞</div>
                                    <div>
                                        <p className="contact-label">تلفن ثابت:</p>
                                        <p className="contact-value">۰۳۵-۹۱۰۰۷۷۱۱</p>
                                    </div>
                                </div>
                                <div className="contact-item">
                                    <div className="contact-icon">📱</div>
                                    <div>
                                        <p className="contact-label">موبایل:</p>
                                        <p className="contact-value">۰۹۹۸۹۱۲۱۲۱۰۷۷۰</p>
                                    </div>
                                </div>
                                <div className="contact-item">
                                    <div className="contact-icon">✉️</div>
                                    <div>
                                        <p className="contact-label">ایمیل:</p>
                                        <p className="contact-value">gtc1210770@gmail.com</p>
                                    </div>
                                </div>
                                <div className="contact-item">
                                    <div className="contact-icon">🌐</div>
                                    <div>
                                        <p className="contact-label">وبسایت:</p>
                                        <p className="contact-value website">https://gtc.market</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Final CTA Section */}
            <section className="final-cta-section">
                <div className="container">
                    <h2>آماده همکاری با شما هستیم</h2>
                    <p>برای دریافت لیست قیمت‌ها و اطلاعات بیشتر، با ما تماس بگیرید</p>
                    <div className="cta-buttons">
                        <button onClick={handleEnterSite} className="cta-btn primary">
                            🚀 ورود به سیستم
                        </button>
                        <a href="tel:+982591007711" className="cta-btn secondary">
                            📞 تماس تلفنی
                        </a>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="container">
                    <div className="footer-content">
                        <h3>شرکت تولیدی بازرگانی گلمحمدی</h3>
                        <p>کیان تجارت پویا کویر</p>
                    </div>
                    <div className="footer-bottom">
                        <p>© ۱۴۰۳ تمامی حقوق محفوظ است. | طراحی و توسعه با ❤️ برای خدمات بهتر</p>
                        <p className="footer-note">این سایت جهت معرفی خدمات شرکت و تسهیل ارتباط با مشتریان طراحی شده است.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;