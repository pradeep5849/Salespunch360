package com.salespunch360.mobile.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.salespunch360.mobile.data.ApiClient
import com.salespunch360.mobile.data.SecureSession
import kotlinx.coroutines.launch

@Composable fun ChangePasswordScreen(){
 val context=LocalContext.current;val api=remember{ApiClient(SecureSession(context))};val scope=rememberCoroutineScope()
 var current by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var confirm by remember{mutableStateOf("")};var busy by remember{mutableStateOf(false)};var message by remember{mutableStateOf<String?>(null)}
 val valid=password.length>=12&&password.any(Char::isLowerCase)&&password.any(Char::isUpperCase)&&password.any(Char::isDigit)&&password==confirm
 Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
  Text("Change password",style=MaterialTheme.typography.headlineSmall);Text("Use at least 12 characters with upper-case, lower-case and a number.")
  OutlinedTextField(current,{current=it;message=null},Modifier.fillMaxWidth(),label={Text("Current password")},visualTransformation=PasswordVisualTransformation(),singleLine=true)
  OutlinedTextField(password,{password=it;message=null},Modifier.fillMaxWidth(),label={Text("New password")},visualTransformation=PasswordVisualTransformation(),singleLine=true)
  OutlinedTextField(confirm,{confirm=it;message=null},Modifier.fillMaxWidth(),label={Text("Confirm new password")},visualTransformation=PasswordVisualTransformation(),singleLine=true,isError=confirm.isNotEmpty()&&password!=confirm)
  message?.let{ContentCard("Password",it)}
  Button({scope.launch{busy=true;message=try{api.changePassword(current,password,confirm);current="";password="";confirm="";"Password changed. For your security, sign in again on your next session."}catch(_:Exception){"Password could not be changed. Check your current password and try again."};busy=false}},Modifier.fillMaxWidth(),enabled=!busy&&current.isNotBlank()&&valid){Text(if(busy)"Saving…" else "Change password")}
 }
}
