"use client";

import React, { createContext, useState, useEffect, useMemo, useCallback } from 'react';
import type { CartItem } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartId'>) => void;
  removeFromCart: (cartId: string, showToast?: boolean) => void;
  clearCart: () => void;
  updateItemPhoneNumber: (cartId: string, newPhoneNumber: string) => void;
  itemCount: number;
  totalPrice: number;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('cart');
      if (storedCart) {
        setCartItems(JSON.parse(storedCart));
      }
    } catch (error) {
      console.error("Failed to parse cart from localStorage", error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cartItems));
    } catch (error) {
      console.error("Failed to save cart to localStorage", error);
    }
  }, [cartItems]);

  const addToCart = useCallback((item: Omit<CartItem, 'cartId'>) => {
    setCartItems(prevItems => {
        const newItem: CartItem = { ...item, cartId: crypto.randomUUID() };
        return [...prevItems, newItem];
    });
    toast({
        title: "Added to Cart",
        description: `${item.dataAmount} for ${item.recipientMsisdn}`,
    });
  }, [toast]);

  const removeFromCart = useCallback((cartId: string, showToast = true) => {
    setCartItems(prevItems => prevItems.filter(item => item.cartId !== cartId));
    if (showToast) {
        toast({
            title: "Item Removed",
            description: "The item has been removed from your cart.",
            variant: "destructive"
        });
    }
  }, [toast]);

  const updateItemPhoneNumber = useCallback((cartId: string, newPhoneNumber: string) => {
    setCartItems(prevItems => 
        prevItems.map(item => 
            item.cartId === cartId ? { ...item, recipientMsisdn: newPhoneNumber } : item
        )
    );
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const itemCount = useMemo(() => cartItems.length, [cartItems]);

  const totalPrice = useMemo(() =>
    cartItems.reduce((total, item) => total + item.price, 0),
    [cartItems]
  );

  const value = {
    cartItems,
    addToCart,
    removeFromCart,
    clearCart,
    updateItemPhoneNumber,
    itemCount,
    totalPrice,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
