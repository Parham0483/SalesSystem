from functools import wraps
from typing import Dict, Any, Optional
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.views.decorators.csrf import ensure_csrf_cookie
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.db import transaction
from .models import Customer, Order, OrderItem, Product, Invoice
from .forms import (
    CustomerRegistrationForm, CustomerLoginForm, OrderForm,
    OrderItemFormSet, OrderApprovalForm, PaymentForm
)


def require_customer_login(view_func):
    """Decorator to check if customer is logged in"""

    @wraps(view_func)
    def wrapper(request: HttpRequest, *args, **kwargs) -> HttpResponse:
        customer_id = request.session.get('customer_id')
        if not customer_id:
            messages.error(request, 'Please log in first.')
            return redirect('customer_login')
        request.customer = get_object_or_404(Customer, id=customer_id)
        return view_func(request, *args, **kwargs)

    return wrapper


def handle_api_error(func):
    """Decorator for consistent API error handling"""

    @wraps(func)
    def wrapper(*args, **kwargs) -> JsonResponse:
        try:
            return func(*args, **kwargs)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=400)

    return wrapper


# Authentication Views
def customer_register(request: HttpRequest) -> HttpResponse:
    if request.method == 'POST':
        form = CustomerRegistrationForm(request.POST)
        if form.is_valid():
            try:
                form.save()
                return JsonResponse({
                    'success': True,
                    'message': 'Registration successful. Please log in.'
                })
            except Exception as e:
                return JsonResponse({'success': False, 'error': str(e)}, status=400)
    form = CustomerRegistrationForm()
    return render(request, 'tasks/customer_register.html', {'form': form})


def customer_login(request: HttpRequest) -> HttpResponse:
    if request.method == 'POST':
        form = CustomerLoginForm(request.POST)
        if form.is_valid():
            try:
                customer = Customer.objects.get(
                    email=form.cleaned_data['email'],
                    password=form.cleaned_data['password']
                )
                request.session['customer_id'] = customer.id
                messages.success(request, 'Login successful!')
                return redirect('customer_dashboard')
            except Customer.DoesNotExist:
                messages.error(request, 'Invalid email or password.')
    else:
        form = CustomerLoginForm()
    return render(request, 'tasks/customer_login.html', {'form': form})


# Customer Dashboard Views
@require_customer_login
def customer_dashboard(request: HttpRequest) -> HttpResponse:
    orders = Order.objects.filter(customer=request.customer)
    context = {
        'customer': request.customer,
        'orders': orders,
        'pending_orders': orders.filter(status='pending_pricing').count(),
        'waiting_approval': orders.filter(status='waiting_customer_approval').count()
    }
    return render(request, 'customers/dashboard.html', context)


# Order Management Views
@require_customer_login
def create_order(request: HttpRequest) -> HttpResponse:
    if request.method == 'POST':
        order_form = OrderForm(request.POST)
        if order_form.is_valid():
            with transaction.atomic():
                order = order_form.save(commit=False)
                order.customer = request.customer
                order.save()
                formset = OrderItemFormSet(request.POST, instance=order)
                if formset.is_valid():
                    formset.save()
                    messages.success(request, 'Order submitted successfully! We will provide pricing soon.')
                    return redirect('customer_dashboard')
    else:
        order_form = OrderForm()
        formset = OrderItemFormSet()

    context = {
        'order_form': order_form,
        'formset': formset,
        'products': Product.objects.filter(is_active=True)
    }
    return render(request, 'orders/create_order.html', context)


@require_customer_login
def order_details(request: HttpRequest, order_id: int) -> HttpResponse:
    order = get_object_or_404(Order, id=order_id, customer=request.customer)

    if request.method == 'POST' and order.status == 'waiting_customer_approval':
        form = OrderApprovalForm(request.POST)
        if form.is_valid():
            decision = form.cleaned_data['decision']
            if decision == 'approve':
                order.customer_approve()
                messages.success(request, 'Order confirmed successfully!')
            else:
                reason = form.cleaned_data['rejection_reason']
                order.customer_reject(reason)
                messages.info(request, 'Order rejected. We will contact you for further details.')
            return redirect('order_details', order_id=order.id)
    else:
        form = OrderApprovalForm()

    return render(request, 'orders/order_details.html', {
        'order': order,
        'form': form
    })


# Admin Views
@login_required
def admin_orders_pending(request: HttpRequest) -> HttpResponse:
    if not request.user.is_staff:
        messages.error(request, 'Access denied. Staff only.')
        return redirect('admin:login')

    orders = Order.objects.filter(status='pending_pricing').order_by('created_at')
    return render(request, 'admin/orders_pending.html', {
        'orders': orders,
        'pending_count': orders.count()
    })


# API Endpoints
@handle_api_error
def get_product_info(request: HttpRequest, product_id: int) -> JsonResponse:
    product = get_object_or_404(Product, id=product_id, is_active=True)
    return JsonResponse({
        'name': product.name,
        'description': product.description,
        'base_price': str(product.base_price),
        'image_url': product.image_url or ''
    })

@login_required
def customer_dashboard(request):
    customer_id = request.session.get('customer_id')
    if not customer_id:
        messages.error(request, 'You Need to log in first.')
        return redirect('customer_login')

    customer = get_object_or_404(Customer, id=customer_id)
    orders = Order.objects.filter()           

    context = {
        'customer': customer,
        'orders': orders,
        'pending_orders' : orders.filter(status='pending_pricing').count(),
        'waiting_approval' : orders.filter(status='waiting_customer_approval').count()
    }   

    return render(request, 'customers/dashboard.html', context)   


@login_required
def create_order(request):
    customer_id = request.session.get('customer_id')
    if not customer_id:
        messages.error(request, 'You nedd to log in first.')
        return redirect('customer_login')
    
    customer = get_object_or_404(Customer, id=customer_id)

    if request.method == 'POST':
       order_form =OrderForm(request.POST)
       if order_form.is_valid():
           with transaction.atomic():
               order = order_form.save(commit=False)
               order.customer = customer
               order.save()

               formset = OrderItemFormSet(request.POST, instance=order)
               if formset.is_valid():
                   messages.success(request, 'Order submited successfully! we will peovide the proces soon. ')
                   return redirect(customer_dashboard)
    else:
        order_form = OrderForm()
        formset = OrderItemFormSet()

    products = Product.objects.filter(is_active = True)
    context = {
        'order_form' : order_form,
        'formset' : formset,
        'products' : products
    }    

    return render (request, 'orders/create_order.html', context)


@login_required
def order_details(request, order_id):
    customer_id = request.session.get('customer_id')
    if not customer_id :
        return redirect('customer_login')
    
    customer = get_object_or_404(Customer, id= customer_id)
    order = get_object_or_404(Order, id=order_id, customer = customer)

    #handle customer rejection or approval
    if request.method == 'POST' and order.status == 'waiting_customer_approval':
        form = OrderApprovalForm(request.POST)
        if form.is_valid():
            decision = form.cleaned_data['decision']

            if decision == 'approve':
                order.customer_approve()
                messages.success(request, 'Order confirmed successfully!')
            else:
                reason = form.cleaned_data['rejection_reason']
                order.customer_reject(reason)
                messages.info(request, 'Order rejected. We will contact you for further details. ')
            return redirect(order_details, order_id=order.id)
    else:
        form = OrderApprovalForm()

    context = {
        'order' : order,
        'form' : form,
    }    
    return render(request, 'orders/order_details.html', context)


@login_required
def admin_orders_pending(request):
    if not request.user.is_staff:
        messages.error(request, 'You do not have permission to view this page.')
        return redirect('admin:login')
    
    orders = Order.objects.filter(status='pending_pricing').order_by('created_at')
    context = {
        'orders': orders,
        'pending_count': orders.count()
    }   
    return render(request, 'admin/orders_pending.html', context)


@login_required
def admin_provide_pricing(request,order_id):
    if not request.user.is_staff:
        messages.error(request, 'You do not have permission to view this page.')
        return redirect('admin:login')
    
    order = get_object_or_404(Order, id=order_id)
    
    if request.method == 'POST':
        all_items_prices = True
        for item in order.items.all():
            quated_price = request.POST.get(f'quoted_price_{item.id}')
            final_quantity = request.POST.get(f'quantity_{item.id}')

            admin_notes = request.POST.get(f'notes_{item.id}')

            if quated_price and final_quantity:
                try:
                    item.quoted_unit_price = float(quated_price)
                    item.final_quantity = int(final_quantity)
                    item.admin_notes = admin_notes or ''
                    item.save()
                except ValueError:
                    all_items_prices = False
            else:
                all_items_prices = False

        if all_items_prices:
            admin_comment = request.POST.get('admin_comment', '')
            order.mark_as_priced_by_admin(admin_comment)
            messages.success(request, 'Pricing provided successfully! The order is now waiting for customer approval.')
            return redirect('admin_orders_pending')
        else:
            messages.error(request, 'Please provide valid prices and quantities for all items.')

    return render(request, 'admin/provide_pricing.html', {'order': order})                
    

@login_required
def get_product_info(request, product_id):
    try: 
        product = Product.objects.get(id=product_id, is_active=True)
        data = {
            'name': product.name,
            'description': product.description,
            'base_price': str(product.base_price),
            'image_url': product.image_url or ''
        }
        return JsonResponse(data)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Product not found'}, status=404) 
    

def process_payment(request, invoice_id):
    customer_id = request.session.get('customer_id')
    if not customer_id:
        return redirect('customer_login')
    
    customer = get_object_or_404(Customer, id=customer_id)
    invoice = get_object_or_404(Invoice, id=invoice_id, order__customer=customer)
    
    if request.method == 'POST':
        form = PaymentForm(request.POST)
        if form.is_valid():
            payment = form.save(commit=False)
            payment.invoice = invoice
            payment.amount = invoice.payable_amount
            payment.is_successful = True  
            payment.save()
            
            # Mark invoice as paid
            invoice.is_paid = True
            invoice.save()
            
            messages.success(request, 'Payment processed successfully!')
            return redirect('customer_dashboard')
    else:
        form = PaymentForm()
    
    context = {
        'invoice': invoice,
        'form': form
    }
    return render(request, 'payments/process_payment.html', context)    

def customer_logout(request):
    if 'customer_id' in request.session:
        del request.session['customer_id']
        messages.success(request, 'You have been logged out successfully.')
    return redirect('customer_login')

@ensure_csrf_cookie
def get_csrf_token(request):
    return JsonResponse({'detail': 'CSRF cookie set'})