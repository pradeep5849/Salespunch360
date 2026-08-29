plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose"); id("org.jetbrains.kotlin.plugin.serialization"); id("com.google.devtools.ksp") }
android { namespace="com.salespunch360.mobile"; compileSdk=35
 defaultConfig { applicationId="com.salespunch360.mobile"; minSdk=26; targetSdk=35; versionCode=1; versionName="1.0-A"; testInstrumentationRunner="androidx.test.runner.AndroidJUnitRunner"; buildConfigField("String","API_BASE_URL","\"https://salespunch360.com/\"") }
 buildFeatures { compose=true; buildConfig=true }
 buildTypes { debug { buildConfigField("String","API_BASE_URL","\"http://10.0.2.2:3000/\"") }; release { isMinifyEnabled=true; proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"),"proguard-rules.pro") } }
 compileOptions { sourceCompatibility=JavaVersion.VERSION_17; targetCompatibility=JavaVersion.VERSION_17 }; kotlinOptions { jvmTarget="17" }
}
dependencies {
 implementation(platform("androidx.compose:compose-bom:2025.01.00")); implementation("androidx.activity:activity-compose:1.10.0"); implementation("androidx.compose.material3:material3"); implementation("androidx.compose.material:material-icons-extended"); implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7"); implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
 implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.1"); implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.0"); implementation("com.squareup.okhttp3:okhttp:4.12.0"); implementation("com.google.android.gms:play-services-location:21.3.0"); implementation("androidx.work:work-runtime-ktx:2.10.0"); implementation("androidx.security:security-crypto:1.1.0-alpha06")
 implementation("androidx.room:room-runtime:2.6.1"); implementation("androidx.room:room-ktx:2.6.1"); ksp("androidx.room:room-compiler:2.6.1")
 testImplementation("junit:junit:4.13.2"); testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.1")
}
