package com.salespunch360.mobile.ui

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.network.NetworkHeaders
import coil3.network.httpHeaders as coilHttpHeaders
import coil3.request.ImageRequest
import com.salespunch360.mobile.FieldViewModel

/** Keeps existing trailing-lambda customer navigation calls source-compatible. */
@Composable
fun CustomersScreen(openCheckIns: () -> Unit) {
    CustomersScreen(openCheckIns = openCheckIns, vm = viewModel<FieldViewModel>())
}

/** Central authenticated-image header bridge for Coil 3 network requests. */
fun ImageRequest.Builder.httpHeaders(headers: NetworkHeaders): ImageRequest.Builder =
    this.coilHttpHeaders(headers)
