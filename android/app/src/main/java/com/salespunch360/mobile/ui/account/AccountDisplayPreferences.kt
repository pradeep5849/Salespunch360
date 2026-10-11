package com.salespunch360.mobile.ui.account

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Currency
import java.util.Locale
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.intOrNull

data class AccountDisplayPreferences(val currency:String="INR",val decimals:Int=2,val dateFormat:String="DD/MM/YYYY",val language:String="en") {
    fun money(value:String):String {
        val amount=value.toBigDecimalOrNull()?:return value
        val formatter=NumberFormat.getCurrencyInstance(Locale(language,"IN"))
        formatter.currency=Currency.getInstance(currency)
        formatter.minimumFractionDigits=decimals
        formatter.maximumFractionDigits=decimals
        return formatter.format(amount)
    }
    fun date(value:String):String {
        val date=value.take(10)
        if(!Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}").matches(date))return date
        val parts=date.split("-")
        return when(dateFormat){"YYYY-MM-DD"->date;"MM/DD/YYYY"->"${parts[1]}/${parts[2]}/${parts[0]}";else->"${parts[2]}/${parts[1]}/${parts[0]}"}
    }
    companion object {
        fun from(data:JsonObject?):AccountDisplayPreferences {
            val currency=data?.get("baseCurrency")?.jsonPrimitive?.content?.takeIf{it in listOf("INR","USD","EUR","GBP","AED")}?:"INR"
            return AccountDisplayPreferences(currency,(data?.get("displayDecimalPlaces")?.jsonPrimitive?.intOrNull?:2).coerceIn(0,4),data?.get("dateFormat")?.jsonPrimitive?.content?:"DD/MM/YYYY",if(data?.get("appLanguage")?.jsonPrimitive?.content=="hi")"hi" else "en")
        }
    }
}
val LocalAccountDisplayPreferences=staticCompositionLocalOf{AccountDisplayPreferences()}
@Composable fun accountMoney(value:String)=LocalAccountDisplayPreferences.current.money(value)
@Composable fun accountMoney(value:BigDecimal)=LocalAccountDisplayPreferences.current.money(value.toPlainString())
@Composable fun accountDate(value:String)=LocalAccountDisplayPreferences.current.date(value)

private val hindiAccountLabels=mapOf(
    "General" to "सामान्य",
    "Settings" to "सेटिंग्स",
    "Home" to "होम",
    "Dashboard" to "डैशबोर्ड",
    "Projects" to "परियोजनाएँ",
    "Items" to "आइटम",
    "APPLICATION" to "एप्लिकेशन",
    "App Language" to "ऐप की भाषा",
    "Business Currency" to "व्यवसाय की मुद्रा",
    "Decimal Places" to "दशमलव स्थान",
    "Date Format" to "तारीख का प्रारूप",
    "Theme" to "थीम",
    "Standard" to "मानक",
    "Show warning for unsaved changes" to "बिना सहेजे बदलावों की चेतावनी दिखाएँ",
    "SECURITY" to "सुरक्षा",
    "Passcode / Fingerprint" to "पासकोड / फिंगरप्रिंट",
    "Not available on Web" to "वेब पर उपलब्ध नहीं",
    "BUSINESS & DATA" to "व्यवसाय और डेटा",
    "Business & Data" to "व्यवसाय और डेटा",
    "Application" to "एप्लिकेशन",
    "Security" to "सुरक्षा",
    "Multi-Branch Settings" to "बहु-शाखा सेटिंग्स",
    "Godown / Warehouse & Stock Transfer" to "गोदाम और स्टॉक स्थानांतरण",
    "Backup Settings" to "बैकअप सेटिंग्स",
    "MORE TRANSACTIONS" to "अन्य लेनदेन",
    "Estimate / Quotation" to "अनुमान / कोटेशन",
    "Proforma Invoice" to "प्रोफॉर्मा इनवॉइस",
    "Other Income" to "अन्य आय",
    "Sale / Purchase Order" to "बिक्री / खरीद ऑर्डर",
    "Fixed Assets" to "स्थायी संपत्तियाँ",
    "Delivery Challan" to "डिलीवरी चालान",
    "Goods Return on Delivery Challan" to "डिलीवरी चालान पर माल वापसी",
    "Print Amount on Challan" to "चालान पर राशि प्रिंट करें",
    "On" to "चालू",
    "Off" to "बंद",
    "Available" to "उपलब्ध",
    "Not available" to "उपलब्ध नहीं",
    "Save General Settings" to "सामान्य सेटिंग्स सहेजें",
    "Unsaved changes" to "बिना सहेजे बदलाव",
    "Leave General Settings without saving your changes?" to "क्या आप बदलाव सहेजे बिना सामान्य सेटिंग्स से बाहर जाना चाहते हैं?",
    "Leave" to "बाहर जाएँ",
    "Stay" to "रुकें",
    "Transaction" to "लेनदेन",
    "Invoice Print" to "इनवॉइस प्रिंट",
    "Taxes & GST" to "कर और GST",
    "Employees" to "कर्मचारी",
    "Transaction SMS" to "लेनदेन SMS",
    "Reminders" to "रिमाइंडर",
    "Party" to "पार्टी",
    "Item" to "आइटम",
    "Multi-Currency" to "बहु-मुद्रा",
    "Sales" to "बिक्री",
    "Purchase" to "खरीद",
    "Inventory" to "इन्वेंटरी",
    "Accounting" to "लेखांकन",
    "Reports" to "रिपोर्ट",
    "Utilities" to "उपयोगिताएँ",
    "My Business" to "मेरा व्यवसाय",
    "Cash & Bank" to "नकद और बैंक",
    "Company / Branch" to "कंपनी / शाखा",
    "Users & Permissions" to "उपयोगकर्ता और अनुमतियाँ",
    "Help / Support" to "सहायता",
    "Back" to "वापस",
    "Save" to "सहेजें",
    "Saving…" to "सहेजा जा रहा है…",
    "Cancel" to "रद्द करें",
    "Close" to "बंद करें",
    "Edit" to "संपादित करें",
    "Delete" to "हटाएँ",
    "Total" to "कुल",
    "Balance" to "शेष",
    "Sale" to "बिक्री",
    "Date" to "तारीख",
    "Print" to "प्रिंट",
    "Share" to "साझा करें",
    "Transaction Details" to "लेनदेन विवरण",
    "Party Details" to "पार्टी विवरण",
    "General Settings" to "सामान्य सेटिंग्स",
    "Payment-In" to "भुगतान प्राप्ति",
    "Payment-Out" to "भुगतान निकासी",
    "Expenses" to "खर्च",
    "Sale Invoice" to "बिक्री इनवॉइस",
    "Sale Order" to "बिक्री ऑर्डर",
    "Purchase Order" to "खरीद ऑर्डर",
    "Purchase Bills" to "खरीद बिल",
    "Customers" to "ग्राहक",
    "Vendors" to "विक्रेता",
    "Warehouses" to "गोदाम",
    "Opening stock" to "प्रारंभिक स्टॉक",
    "Transfers & adjustments" to "स्थानांतरण और समायोजन",
    "Items & stock" to "आइटम और स्टॉक",
    "Assets" to "संपत्तियाँ",
    "Reports hub" to "रिपोर्ट केंद्र",
    "Profit & Loss" to "लाभ और हानि",
    "Balance Sheet" to "बैलेंस शीट",
    "Trial Balance" to "ट्रायल बैलेंस",
    "Chart of Accounts" to "खातों की सूची",
    "Journals" to "जर्नल",
    "Financial Years" to "वित्तीय वर्ष",
    "Period Locks" to "अवधि लॉक",
    "Company details" to "कंपनी विवरण",
    "English" to "अंग्रेज़ी",
    "Hindi" to "हिन्दी"
)
@Composable fun accountLabel(value:String):String=if(LocalAccountDisplayPreferences.current.language=="hi")hindiAccountLabels[value]?:value else value
