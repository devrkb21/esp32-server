import { getServiceUrl } from '../api';
import RequestService from '../httpRequest';

// Products (TinyBot and other Nobix devices): the catalog every signed-in person reads, and the
// super admin's page, create, update and delete. A product's `features` decide which screens a
// device of that product shows.
export default {
    // Enabled products: [{ productKey, nameEn, nameBn, iconUrl, features, sort }]
    getProductList(callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/product/list`)
            .method('GET')
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) failCallback(err);
            })
            .networkFail((err) => {
                console.error('Failed to get product list:', err);
                if (failCallback) failCallback(err);
            }).send();
    },
    // Admin: one page of products ({ page, limit, keywords })
    getProductPage(params, callback, failCallback) {
        const query = new URLSearchParams({
            page: params.page || 1,
            limit: params.limit || 10,
            keywords: params.keywords || '',
        }).toString();
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/product/page?${query}`)
            .method('GET')
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) failCallback(err);
            })
            .networkFail((err) => {
                console.error('Failed to get product page:', err);
                RequestService.reAjaxFun(() => {
                    this.getProductPage(params, callback, failCallback);
                });
            }).send();
    },
    // Admin: create (body without id)
    addProduct(data, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/product`)
            .method('POST')
            .data(data)
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) failCallback(err);
            })
            .networkFail((err) => {
                console.error('Failed to add product:', err);
                if (failCallback) failCallback(err);
            }).send();
    },
    // Admin: update (body with id, full replace)
    updateProduct(data, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/product`)
            .method('PUT')
            .data(data)
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) failCallback(err);
            })
            .networkFail((err) => {
                console.error('Failed to update product:', err);
                if (failCallback) failCallback(err);
            }).send();
    },
    // Admin: delete by ids (the generic product is refused by the server)
    deleteProducts(ids, callback, failCallback) {
        RequestService.sendRequest()
            .url(`${getServiceUrl()}/product`)
            .method('DELETE')
            .data(ids)
            .success((res) => {
                RequestService.clearRequestTime();
                callback(res);
            })
            .fail((err) => {
                RequestService.clearRequestTime();
                if (failCallback) failCallback(err);
            })
            .networkFail((err) => {
                console.error('Failed to delete products:', err);
                if (failCallback) failCallback(err);
            }).send();
    },
};
