import SiteContent from '../../models/SiteContent.js'
import { deleteImage, saveImage } from '../../lib/upload.js'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PUBLIC_DIR = join(__dirname, '..', '..', 'public')

const CONTENT_PAGES = [
  {
    key: 'layout',
    label: 'Layout / Navigation',
    fields: [
      field('brandName', 'Brand name', 'Loccake'),
      field('navHome', 'Navbar home label', 'Ana Sayfa'),
      field('navMenu', 'Navbar menu label', 'Ürünler'),
      field('navAbout', 'Navbar about label', 'Hakkımızda'),
      field('navBlog', 'Navbar blog label', 'Blog'),
      field('navContact', 'Navbar contact label', 'İletişim'),
      field('navCall', 'Navbar call trigger label', 'Ara'),
      field('navOrder', 'Navbar order button', 'Sipariş Ver'),
      field('mobileHome', 'Mobile home label', 'Ana Sayfa'),
      field('mobileMenu', 'Mobile menu label', 'Ürünler'),
      field('mobileCall', 'Mobile call label', 'Ara'),
      field('mobileWhatsapp', 'Mobile WhatsApp label', 'WhatsApp'),
      field('mobileContact', 'Mobile contact label', 'İletişim'),
      field('whatsappHref', 'Main WhatsApp link', 'https://wa.me/905558937078?text=Merhaba,%20bilgi%20almak%20istiyorum', 'url'),
      field('modalTitle', 'Contact modal title', 'Loccake İletişim'),
      field('modalCloseLabel', 'Contact modal close label', 'Kapat'),
      field('modalAddressLabel', 'Contact modal address label', 'Konum / Adres'),
      field('modalAddressText', 'Contact modal address text', 'Alsancak Mahallesi 1440 Sokak 20/B\nKonak, İzmir, Türkiye', 'textarea'),
      field('modalMapButton', 'Contact modal map button', 'Yol Tarifi Al (Google Maps)'),
      field('modalMapHref', 'Contact modal map link', 'https://maps.google.com/maps?daddr=Alsancak+Mahallesi+1440+Sokak+20%2FB+Konak+%C4%B0zmir+Turkey', 'url'),
      field('modalPhoneLabel', 'Contact modal phone label', 'Telefon Numarası'),
      field('modalPhoneText', 'Contact modal phone display', '0555 893 70 78'),
      field('modalPhoneHref', 'Contact modal phone link', 'tel:+905558937078'),
      field('modalPhoneButton', 'Contact modal phone button', 'Hemen Ara'),
      field('footerDescription', 'Footer description', 'Rus & Avrupa Pastaları\nİzmir, Alsancak', 'textarea'),
      field('footerPagesTitle', 'Footer pages title', 'Sayfalar'),
      field('footerServicesTitle', 'Footer services title', 'Hizmetler'),
      field('footerDelivery', 'Footer delivery label', 'Paket Servis'),
      field('footerPayment', 'Footer payment label', 'Ödeme Yöntemleri'),
      field('footerBirthday', 'Footer birthday label', 'Doğum Günü Partileri'),
      field('footerCopyright', 'Footer copyright', 'Loccake Cafe & Cakes. Tüm hakları saklıdır.'),
    ],
  },
  {
    key: 'home',
    label: 'Home Page',
    fields: [
      field('heroImage', 'Hero background image', '/uploads/9875270b9d7bdb52e4e3707c3e5d92fd.jpg', 'image'),
      field('heroImageAlt', 'Hero background alt', 'Medovik pasta ve Loccake tatlıları'),
      field('heroBadge', 'Hero badge', "— 2018'den beri · El yapımı lezzetler —"),
      field('heroTitleLine1', 'Hero title line 1', 'Geleneksel Rus &'),
      field('heroTitleEmphasis', 'Hero title emphasis', 'Avrupa Pastaları'),
      field('heroDescription', 'Hero description', "Moskova'dan İzmir'e uzanan lezzet yolculuğu. Efsanevi Medovik'ten zarif Napolyon'a, her pasta özenle ve geleneksel tariflerle hazırlanır.", 'textarea'),
      field('heroPrimaryButton', 'Hero primary button', 'Ürünleri Keşfet'),
      field('heroSecondaryButton', 'Hero secondary button', 'Hikayemiz'),
      field('productsTag', 'Products section tag', 'Ürünlerimiz'),
      field('productsTitle', 'Products section title', 'Eşsiz Lezzetler'),
      field('productsDescription', 'Products section description', 'Farklı kültürlere ait, özenle hazırlanan pastalarımız'),
      field('productsButton', 'Products button', 'Tüm Ürünleri Gör →'),
      field('aboutImage', 'About image', '/uploads/seed-irina-ozgur.jpg', 'image'),
      field('aboutImageAlt', 'About image alt', 'Loccake hakkında'),
      field('aboutTag', 'About tag', 'Hakkımızda'),
      field('aboutTitle', 'About title', 'Loccake Ailesi'),
      field('aboutText1', 'About text 1', "Moskova'da başlayan lezzet yolculuğu İzmir'de devam ediyor. Loccake ilk defa 2018 yılında Alsancak'da kapılarını açtı.", 'textarea'),
      field('aboutText2', 'About text 2', "Rusya'nın o büyülü pastalarını, enfes lezzetlerini geleneksel usuller ve malzemeler ile sizler için üretiyoruz. Her pasta, sevgiyle ve özenle hazırlanır.", 'textarea'),
      field('aboutButton', 'About button', 'Daha Fazlasını Keşfedin'),
      field('reviewsTag', 'Reviews tag', 'Müşteri Yorumları'),
      field('reviewsTitle', 'Reviews title', 'Misafirlerimiz Ne Diyor?'),
      field('review1Text', 'Review 1 text', "Medovik ve Spartak'a bayıldım... çok çok güzeldi. Böyle tadı yalnız Rusya'da yiyebilirsiniz.", 'textarea'),
      field('review1Author', 'Review 1 author', 'Nur Hanım'),
      field('review2Text', 'Review 2 text', 'Tatlıları çok güzel, kahveleri de öyle. Serviste güler yüzlü, çok güzel insanlar.', 'textarea'),
      field('review2Author', 'Review 2 author', 'Görkem K.'),
      field('review3Text', 'Review 3 text', "Herhalde İzmir'in en iyi beş pastacısından biri bunlar. Krema yapmayı biliyorlar.", 'textarea'),
      field('review3Author', 'Review 3 author', 'Gülce B.'),
      field('galleryTag', 'Gallery tag', 'Galeri'),
      field('galleryTitle', 'Gallery title', 'Lezzetlerden Kareler'),
      field('blogTag', 'Blog section tag', 'Blog'),
      field('blogTitle', 'Blog section title', 'Lezzet Hikayeleri'),
      field('blogDescription', 'Blog section description', 'Medovik tarihi, Rus pastaları ve İzmir Alsancak Loccake\'den lezzet rehberleri.', 'textarea'),
      field('blogButton', 'Blog section button', 'Tüm Yazıları Oku →'),
      field('servicesTag', 'Services tag', 'Hizmetlerimiz'),
      field('servicesTitle', 'Services title', 'Sizin İçin Neler Yapıyoruz?'),
      field('service1Title', 'Service 1 title', 'Paket Servis'),
      field('service1Text', 'Service 1 text', 'Mağazadan teslim, WhatsApp ve telefon ile kolayca sipariş verin.', 'textarea'),
      field('service2Title', 'Service 2 title', 'Ödeme Yöntemleri'),
      field('service2Text', 'Service 2 text', 'Nakit, kredi kartı, EFT/havale ve online ödeme seçenekleri.', 'textarea'),
      field('service3Title', 'Service 3 title', 'Doğum Günü Partileri'),
      field('service3Text', 'Service 3 text', 'Özel günleriniz için pastalar ve organizasyon desteği sunuyoruz.', 'textarea'),
      field('contactTag', 'Contact CTA tag', 'İletişim'),
      field('contactTitle', 'Contact CTA title', 'Bize Ulaşın'),
      field('contactText', 'Contact CTA text', 'Alsancak Mahallesi 1440 Sokak 20/B, Konak, İzmir · 0555 893 70 78 · Pzt-Cum: 12:00 - 20:00', 'textarea'),
      field('contactPrimaryButton', 'Contact primary button', 'İletişim Sayfası'),
      field('contactWhatsappButton', 'Contact WhatsApp button', 'WhatsApp ile Yazın'),
    ],
  },
  {
    key: 'menu',
    label: 'Menu Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-medovik-pasta-izmir.jpg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake ürünleri ve Rus pastaları'),
      field('headerTitle', 'Header title', 'Ürünlerimiz'),
      field('headerSubtitle', 'Header subtitle', 'Geleneksel Rus ve Avrupa pastaları, özenle hazırlanmış kurabiyeler'),
      field('emptyText', 'Empty menu text', 'Henüz ürün eklenmemiştir.'),
      field('noteText', 'Menu note text', 'Fiyatlar mağaza teslim fiyatlarıdır. Teslimat ücreti dahil değildir.'),
      field('orderText', 'Order text', 'Sipariş ve teslimat için:'),
      field('whatsappLabel', 'WhatsApp label', 'WhatsApp'),
    ],
  },
  {
    key: 'about',
    label: 'About Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-cafe-1.jpeg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake cafe atmosferi'),
      field('headerTitle', 'Header title', 'Neler Yapıyoruz?'),
      field('headerSubtitle', 'Header subtitle', 'Gerçek tatlar — Rus ve dünya lezzetleri'),
      field('pastriesTag', 'Pastries tag', 'Lezzetler'),
      field('pastriesTitle', 'Pastries title', 'Loccake Rus Pastaları ve Tatlıları'),
      field('pastriesText1', 'Pastries text 1', 'Sadece kaliteli ve lezzetli olmak dışında bir özelliğimiz daha var: Özgün olmak.', 'textarea'),
      field('pastriesText2', 'Pastries text 2', "Sadece Loccake'de bulabileceğiniz Rus Pastalarının benzersiz tatları, pasta algınızı tamamen değiştirecek.", 'textarea'),
      field('pastriesText3', 'Pastries text 3', "Medovik, Napolyon, Spartak, Oreshki başta olmak üzere Rus pastalarını yerken kendinizi Moskova'da Tverskaya Bulvarında bir kafede oturmuş pastanızı yiyormuş gibi hissedeceksiniz.", 'textarea'),
      field('pastriesText4', 'Pastries text 4', 'Cafemizde enfes kahveler eşliğinde pastalarınızı yedikten sonra dilerseniz paket servis hizmetimiz ile sevdiklerinize de dilim veya bütün olarak pastalarımızdan götürebilirsiniz.', 'textarea'),
      field('pastriesButton', 'Pastries button', 'Ürünleri Keşfet'),
      field('categoriesTag', 'Categories tag', 'Ürün Çeşitlerimiz'),
      field('categoriesTitle', 'Categories title', 'Neler Hazırlıyoruz?'),
      field('cafeImage', 'Cafe image', '/uploads/seed-cafe-2.jpeg', 'image'),
      field('cafeImageAlt', 'Cafe image alt', 'Loccake Cafe'),
      field('cafeTag', 'Cafe tag', 'Mekan'),
      field('cafeTitle', 'Cafe title', 'Loccake Cafe'),
      field('cafeText1', 'Cafe text 1', "Kaliteli vakit geçirmek herkesin hakkı! Bazen dostlarınızla hoş sohbetlerinizde, bazen de iş buluşmalarınızda ya da tek başınıza kaliteli zaman geçirmek istediğinizde Alsancak'daki eviniz Loccake.", 'textarea'),
      field('cafeText2', 'Cafe text 2', 'Huzurlu bir atmosfer, içinizi açacak bir iç tasarım, enfes kahve ve tatlılar ile zamanın nasıl geçtiğini anlamayacaksınız.', 'textarea'),
      field('cafeText3', 'Cafe text 3', '"Sosyal Masamızda" tek başınıza ya da grup olarak ders çalışabilirsiniz. Sunumlarınızı gerçekleştirmek için geniş bir ortam sunuyoruz.', 'textarea'),
      field('cafeText4', 'Cafe text 4', "Alsancak'ın ve doğal olarak İzmir'in tam merkezindeyiz. Ama bir o kadar da gürültüsünün, karmaşasının uzağındayız.", 'textarea'),
      field('cafeButton', 'Cafe button', 'Nasıl Ulaşırım?'),
      field('galleryTag', 'Cafe gallery tag', 'Mekanımız'),
      field('galleryTitle', 'Cafe gallery title', "Cafe'den Kareler"),
      ...galleryFields('gallery', [
        ['/uploads/seed-cafe-1.jpeg', 'Loccake Cafe'],
        ['/uploads/seed-cafe-2.jpeg', 'Loccake Cafe'],
        ['/uploads/seed-cafe-3.jpeg', 'Loccake Cafe'],
        ['/uploads/seed-cafe-4.jpeg', 'Loccake Cafe'],
        ['/uploads/seed-cafe-5.jpeg', 'Loccake Cafe'],
        ['/uploads/seed-cafe-6.jpeg', 'Loccake Cafe'],
      ]),
      field('storyTag', 'Story tag', 'Hikaye'),
      field('storyTitle', 'Story title', 'Location Cake'),
      field('storyText1', 'Story text 1', 'Loccake; Location ve Cake kelimelerinin birleşiminden meydana geliyor. Bir nevi "pasta mekanı" da diyebiliriz.', 'textarea'),
      field('storyText2', 'Story text 2', "Amacımız dostlarımızın belki doğum günlerinde, yılbaşında, sevgililer gününde ya da belki de sadece bir kahve içerken bu mekana uğramaları ve o güzel anlarına Loccake'i de dahil etmeleri.", 'textarea'),
      field('storyText3', 'Story text 3', 'Bizi arayabilirsiniz ya da WhatsApp\'tan yazabilirsiniz. Böylelikle karşılıklı konuşarak nasıl bir lezzette buluşacağımıza karar verebiliriz.', 'textarea'),
      field('storyButton', 'Story button', 'İletişime Geçin'),
    ],
  },
  {
    key: 'contact',
    label: 'Contact Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-cafe-3.jpeg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake iletişim ve cafe konumu'),
      field('headerTitle', 'Header title', 'İletişim'),
      field('headerSubtitle', 'Header subtitle', 'Sipariş ve bilgi için bize ulaşın'),
      field('infoTag', 'Info tag', 'İletişim'),
      field('infoTitle', 'Info title', 'Bize Ulaşın'),
      field('addressLabel', 'Address label', 'Adres'),
      field('addressText', 'Address text', 'Alsancak Mahallesi 1440 Sokak 20/B\nKonak, İzmir, Türkiye', 'textarea'),
      field('phoneLabel', 'Phone label', 'Telefon'),
      field('phoneText', 'Phone display text', '0555 893 70 78'),
      field('phoneHref', 'Phone link', 'tel:+905558937078'),
      field('emailLabel', 'Email label', 'E-posta'),
      field('emailText', 'Email display text', 'info@loccake.com'),
      field('emailHref', 'Email link', 'mailto:info@loccake.com'),
      field('hoursLabel', 'Hours label', 'Çalışma Saatleri'),
      field('hoursText', 'Hours lines', 'Pazartesi: 12:00 - 20:00\nSalı: 12:00 - 20:00\nÇarşamba: 12:00 - 20:00\nPerşembe: 12:00 - 20:00\nCuma: 12:00 - 20:00\nCumartesi: Kapalı\nPazar: Kapalı', 'textarea'),
      field('whatsappButton', 'WhatsApp button', 'WhatsApp ile Yazın'),
      field('whatsappHref', 'WhatsApp link', 'https://wa.me/905558937078?text=Merhaba,%20bilgi%20almak%20istiyorum', 'url'),
      field('mapButton', 'Map button', 'Yol Tarifi Al'),
      field('mapHref', 'Map link', 'https://maps.google.com/maps?daddr=Alsancak+Mahallesi+1440+Sokak+20%2FB+Konak+%C4%B0zmir+Turkey', 'url'),
      field('mapEmbed', 'Google map embed URL', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3125.8!2d27.144111!3d38.438194!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x14bbd8e66b3a3eeb%3A0x1c3d1c8c1c4dd5e8!2sLoccake!5e0!3m2!1str!2str!4v1700000000', 'url'),
      field('orderTag', 'Order tag', 'Sipariş Bilgisi'),
      field('orderTitle', 'Order title', 'Sipariş Öncesi'),
      field('orderText1', 'Order text 1', "Web sayfamızdan, Facebook veya Instagram'dan ya da telefondan sipariş verebilirsiniz.", 'textarea'),
      field('orderText2', 'Order text 2', 'Sipariş hazırlama süreleri ürüne göre değişiklik göstermektedir. Rus Pastaları için 2-3 gün, diğer temalı ve dekorlu pastalar için 4-7 gün arasındaki süreler genelde yeterli gelmektedir.', 'textarea'),
      field('orderText3', 'Order text 3', 'Yoğunluk durumuna göre Rus Pastalarını (Medovik, Napolyon) ertesi güne yetiştirme durumumuz olabilir ama bunun öncesinde telefon ile görüşüp karşılıklı teyit etmek gerekiyor.', 'textarea'),
      field('reachTag', 'Reach tag', 'Ulaşım'),
      field('reachTitle', 'Reach title', 'Nasıl Ulaşırım?'),
      field('reach1Title', 'Reach 1 title', 'Araç ile'),
      field('reach1Text', 'Reach 1 text', 'Google Maps\'ten "Loccake" aratarak kolayca ulaşabilirsiniz. Yakınlarında otopark mevcuttur.', 'textarea'),
      field('reach2Title', 'Reach 2 title', 'Yaya'),
      field('reach2Text', 'Reach 2 text', "Alsancak Kordon'dan yürüyerek 5 dakika mesafedeyiz. 1440 Sokak üzerindeyiz.", 'textarea'),
      field('reach3Title', 'Reach 3 title', 'İzban / Metro'),
      field('reach3Text', 'Reach 3 text', 'Alsancak İzban durağı veya Çankaya Metro durağından yürüyerek ulaşabilirsiniz.', 'textarea'),
    ],
  },
  {
    key: 'delivery',
    label: 'Delivery Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-cafe-1.jpeg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake paket servis'),
      field('headerTitle', 'Header title', 'Paket Servis'),
      field('headerSubtitle', 'Header subtitle', 'Loccake lezzetlerini evinize getirmenin yolları'),
      field('sectionTag', 'Section tag', 'Sipariş Kanalları'),
      field('sectionTitle', 'Section title', 'Nasıl Sipariş Verebilirsiniz?'),
      field('sectionDescription', 'Section description', 'Birden fazla kanaldan kolayca sipariş verebilirsiniz'),
      field('card1Title', 'Card 1 title', 'Mağazadan Teslim'),
      field('card1Text', 'Card 1 text', "Alsancak'da bulunan cafemizi ziyaret ederek taptaze ve birbirinden leziz ürünlerimizi paket olarak alabilirsiniz.", 'textarea'),
      field('card2Title', 'Card 2 title', 'WhatsApp Sipariş'),
      field('card2Text', 'Card 2 text', 'WhatsApp ile bize kolayca ulaşabilirsiniz. Hızlı ve pratik sipariş için hemen yazın.', 'textarea'),
      field('card2Href', 'Card 2 link', 'https://wa.me/905558937078?text=Merhaba,%20sipari%C5%9F%20vermek%20istiyorum', 'url'),
      field('card3Title', 'Card 3 title', 'Instagram DM'),
      field('card3Text', 'Card 3 text', 'Instagram sayfamızı ziyaret edip, Direct Message ile sipariş verebilirsiniz.', 'textarea'),
      field('card3Href', 'Card 3 link', 'https://www.instagram.com/loccake', 'url'),
      field('card4Title', 'Card 4 title', 'Telefon'),
      field('card4Text', 'Card 4 text', 'Bizi arayarak sipariş verebilir veya sorularınızı sorabilirsiniz: 0555 893 70 78', 'textarea'),
      field('card4Href', 'Card 4 link', 'tel:+905558937078'),
      field('card5Title', 'Card 5 title', 'Online Ödeme'),
      field('card5Text', 'Card 5 text', 'Banka kartı veya kredi kartı ile online ödeme kolaylığını yaşayın.', 'textarea'),
      field('noteText', 'Note text', 'Fiyatlar mağaza teslim fiyatlarıdır. Teslimat ücreti dahil değildir.', 'textarea'),
    ],
  },
  {
    key: 'payment',
    label: 'Payment Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-medovik-pasta-izmir.jpg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake ödeme yöntemleri'),
      field('headerTitle', 'Header title', 'Ödeme Yöntemleri'),
      field('headerSubtitle', 'Header subtitle', 'Siparişleriniz için güvenli ödeme seçenekleri'),
      field('sectionTag', 'Section tag', 'Ödeme'),
      field('sectionTitle', 'Section title', 'Nasıl Ödeme Yapabilirsiniz?'),
      field('sectionDescription', 'Section description', 'Size en uygun ödeme yöntemini seçin'),
      field('cashTitle', 'Cash title', 'Nakit Ödeme'),
      field('cashText', 'Cash text', 'Mağazamızda nakit ödeme yapabilirsiniz. Teslim anında ödemenizi kolayca gerçekleştirin.', 'textarea'),
      field('cardTitle', 'Card payment title', 'Kredi / Banka Kartı'),
      field('cardText', 'Card payment text', 'Mağazamızda veya online olarak kredi kartı ve banka kartı ile ödeme yapabilirsiniz.', 'textarea'),
      field('bankTitle', 'Bank transfer title', 'Banka EFT / Havale'),
      field('bankDetails', 'Bank details', 'IBAN: TR43 0011 1000 0000 0063 0607 92\nHesap No: 63060792\nŞube Kodu: 03663\nBanka: Finansbank / EnPara\nAd Soyad: Özgür Tüzünler', 'textarea'),
      field('whatsappTitle', 'WhatsApp payment title', 'WhatsApp ile Ödeme Linki'),
      field('whatsappText', 'WhatsApp payment text', "Bize WhatsApp'tan yazın, size özel ödeme linki gönderelim. Kredi kartı ile güvenle ödeyin.", 'textarea'),
      field('whatsappHref', 'WhatsApp payment link', 'https://wa.me/905558937078?text=Merhaba,%20online%20%C3%B6deme%20yapmak%20istiyorum', 'url'),
      field('noteText', 'Note text', 'Fiyatlar mağaza teslim fiyatlarıdır. Teslimat ücreti dahil değildir.', 'textarea'),
    ],
  },
  {
    key: 'birthday',
    label: 'Birthday Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-birthday-1.jpeg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake doğum günü kutlaması'),
      field('headerTitle', 'Header title', 'Doğum Günü Partileri'),
      field('headerSubtitle', 'Header subtitle', 'Unutulmaz anlar, sıcacık ortam'),
      field('introTag', 'Intro tag', 'Kutlama'),
      field('introTitle', 'Intro title', "Yeni Yaşınıza Loccake'de Girmek İster misiniz?"),
      field('introText1', 'Intro text 1', 'Unutulmaz anlarınızda yanınızda olmak bizim için büyük mutluluk. Doğum günlerinizi dilerseniz Loccake atmosferinde kutlayabilirsiniz.', 'textarea'),
      field('introText2', 'Intro text 2', 'Doğum günü pastası, Cupcake, Muffin, şekerlemeler ve daha birçok özel lezzeti kendimiz hazırlıyoruz. Tamamen doğal ve şeker hamursuz.', 'textarea'),
      field('introText3', 'Intro text 3', 'Dilerseniz balon, süsleme, Candy Bar ve parti dekor hizmetleri de sağlıyoruz. İsterseniz tamamen spontane gelişen, bir dilim pasta ve tek mum ile kutlayacağınız bir doğum günü olsun. Ya da sevdiklerinizle kutlayacağınız kalabalık bir doğum günü partisi olsun — biz her zaman yanınızdayız.', 'textarea'),
      field('galleryTag', 'Gallery tag', 'Galeri'),
      field('galleryTitle', 'Gallery title', 'Partilerden Kareler'),
      ...galleryFields('gallery', [
        ['/uploads/seed-birthday-1.jpeg', 'Doğum günü partisi'],
        ['/uploads/seed-birthday-2.jpeg', 'Doğum günü partisi'],
        ['/uploads/seed-birthday-3.jpeg', 'Doğum günü partisi'],
        ['/uploads/seed-birthday-4.jpeg', 'Doğum günü kutlaması'],
        ['/uploads/seed-birthday-5.jpeg', 'Doğum günü kutlaması'],
        ['/uploads/seed-birthday-6.jpeg', 'Doğum günü kutlaması'],
      ]),
      field('ctaTitle', 'CTA title', 'Hadi Kutlayalım!'),
      field('ctaText', 'CTA text', "Doğum günü organizasyonunuz için bizi arayabilir veya WhatsApp'tan yazabilirsiniz. Birlikte harika bir kutlama planlayalım.", 'textarea'),
      field('whatsappButton', 'WhatsApp button', 'WhatsApp ile Yazın'),
      field('whatsappHref', 'WhatsApp link', 'https://wa.me/905558937078?text=Merhaba,%20doğum%20günü%20organizasyonu%20hakkında%20bilgi%20almak%20istiyorum', 'url'),
      field('phoneButton', 'Phone button', '0555 893 70 78'),
      field('phoneHref', 'Phone link', 'tel:+905558937078'),
    ],
  },
  {
    key: 'blog',
    label: 'Blog Page',
    fields: [
      field('headerImage', 'Header background image', '/uploads/seed-medovik.jpg', 'image'),
      field('headerImageAlt', 'Header background alt', 'Loccake blog ve Medovik yazıları'),
      field('headerTitle', 'Header title', 'Blog'),
      field('headerSubtitle', 'Header subtitle', 'Medovik, Rus pastaları ve Loccake’den lezzet hikayeleri'),
    ],
  },
]

function field(key, label, value, type = 'text', help = '') {
  if (type === 'image' && !help) {
    help = 'Upload the original image file. The preview is scaled in admin; the size above is the original file resolution.'
  }

  return { key, label, type, value, help }
}

function galleryFields(prefix, images) {
  return images.flatMap(([image, alt], index) => {
    const number = index + 1
    return [
      field(`${prefix}${number}Image`, `Gallery ${number} image`, image, 'image'),
      field(`${prefix}${number}Alt`, `Gallery ${number} alt`, alt),
    ]
  })
}

async function getImageMeta(imageUrl) {
  if (!imageUrl || !imageUrl.startsWith('/uploads/')) return null

  const filename = imageUrl.replace('/uploads/', '')
  if (filename.includes('/') || filename.includes('..')) return null

  try {
    const buffer = await readFile(join(PUBLIC_DIR, 'uploads', filename))
    const dimensions = readImageDimensions(buffer, filename)
    if (!dimensions) return null

    return {
      width: dimensions.width,
      height: dimensions.height,
      label: `${dimensions.width} x ${dimensions.height}px`,
    }
  } catch {
    return null
  }
}

function readImageDimensions(buffer, filename) {
  const lower = filename.toLowerCase()

  if (buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  if (buffer.length >= 10 && (lower.endsWith('.gif') || buffer.toString('ascii', 0, 3) === 'GIF')) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
  }

  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return readWebpDimensions(buffer)
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    return readJpegDimensions(buffer)
  }

  if (lower.endsWith('.svg')) {
    return readSvgDimensions(buffer.toString('utf8'))
  }

  return null
}

function readJpegDimensions(buffer) {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
    }
    offset += 2 + length
  }
  return null
}

function readWebpDimensions(buffer) {
  const chunk = buffer.toString('ascii', 12, 16)
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 }
  }
  return null
}

function readSvgDimensions(svg) {
  const width = svg.match(/\bwidth=["']([\d.]+)/i)?.[1]
  const height = svg.match(/\bheight=["']([\d.]+)/i)?.[1]
  if (width && height) return { width: Math.round(Number(width)), height: Math.round(Number(height)) }

  const viewBox = svg.match(/\bviewBox=["'][^"']*?\s([\d.]+)\s([\d.]+)["']/i)
  if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) }

  return null
}

async function normalizePage(savedPage, definition) {
  const savedFields = new Map((savedPage?.fields || []).map(item => [item.key, item]))

  const fields = []
  for (const defaultField of definition.fields) {
    const value = String(savedFields.get(defaultField.key)?.value ?? defaultField.value ?? '')
    fields.push({
      ...defaultField,
      value,
      imageMeta: defaultField.type === 'image' ? await getImageMeta(value) : null,
    })
  }

  return {
    key: definition.key,
    label: definition.label,
    fields,
  }
}

async function normalizeSettings(document) {
  const raw = document?.toObject ? document.toObject() : (document || {})
  const savedPages = new Map((raw.pages || []).map(item => [item.key, item]))

  const pages = []
  for (const page of CONTENT_PAGES) {
    pages.push(await normalizePage(savedPages.get(page.key), page))
  }

  return {
    pages,
  }
}

function toPageContent(page) {
  const content = {}
  for (const field of page.fields) {
    content[field.key] = field.value
    content[`${field.key}Lines`] = String(field.value || '').split('\n').map(line => line.trim()).filter(Boolean)
  }
  return content
}

export const contentStore = {
  async getSettings() {
    const document = await SiteContent.findOne({ key: 'default' })
    return normalizeSettings(document)
  },

  async getAdminSettings() {
    return this.getSettings()
  },

  async getAdminPage(key) {
    const settings = await this.getSettings()
    return settings.pages.find(item => item.key === key) || null
  },

  async getPageContent(key) {
    const settings = await this.getSettings()
    const page = settings.pages.find(item => item.key === key)
    if (!page) return {}
    return toPageContent(page)
  },

  async updatePage(key, data, files = []) {
    const settings = await this.getSettings()
    const page = settings.pages.find(item => item.key === key)
    if (!page) return null
    const uploaded = new Map(
      files
        .filter(file => file.filename && file.size > 0)
        .map(file => [file.fieldname, file]),
    )

    const pages = []
    for (const item of settings.pages) {
      if (item.key !== key) {
        pages.push(item)
        continue
      }

      const fields = []
      for (const field of item.fields) {
        let value = String(data[field.key] ?? field.value ?? '')
        const file = uploaded.get(`${field.key}File`)
        if (field.type === 'image' && file) {
          const newImage = await saveImage(file)
          if (newImage) {
            await deleteImage(value)
            value = newImage
          }
        }

        fields.push({
          key: field.key,
          label: field.label,
          type: field.type,
          help: field.help,
          value,
        })
      }

      pages.push({
        key: item.key,
        label: item.label,
        fields,
      })
    }

    return SiteContent.findOneAndUpdate(
      { key: 'default' },
      { $set: { pages } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  },

  async updateSettings(data) {
    const pages = CONTENT_PAGES.map(page => ({
      key: page.key,
      label: page.label,
      fields: page.fields.map(defaultField => ({
        key: defaultField.key,
        label: defaultField.label,
        type: defaultField.type,
        help: defaultField.help,
        value: String(data[`${page.key}__${defaultField.key}`] ?? defaultField.value ?? ''),
      })),
    }))

    return SiteContent.findOneAndUpdate(
      { key: 'default' },
      { $set: { pages } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  },
}