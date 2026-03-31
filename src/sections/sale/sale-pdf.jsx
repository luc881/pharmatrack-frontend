import { useMemo, useState, useCallback } from 'react';
import { pdf, Page, Text, View, Font, Image, Document, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';

import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { fCurrency } from 'src/utils/format-number';

import axiosInstance, { endpoints } from 'src/lib/axios';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

export function SalePDFRowButton({ sale, productMap }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [detailsRes, paymentsRes] = await Promise.all([
        axiosInstance.get(endpoints.saleDetail.list, { params: { sale_id: sale.id } }),
        axiosInstance.get(endpoints.salePayment.list, { params: { sale_id: sale.id } }),
      ]);
      const saleDetails = Array.isArray(detailsRes.data) ? detailsRes.data : (detailsRes.data?.data ?? []);
      const salePayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : (paymentsRes.data?.data ?? []);

      const blob = await pdf(
        <SalePdfDocument
          sale={sale}
          saleDetails={saleDetails}
          salePayments={salePayments}
          productMap={productMap}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `venta-${sale.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setLoading(false);
    }
  }, [sale, productMap, loading]);

  return (
    <Tooltip title="Descargar PDF">
      <span>
        <IconButton size="small" onClick={handleDownload} disabled={loading}>
          {loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <Iconify icon="eva:cloud-download-fill" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}

// ----------------------------------------------------------------------

Font.register({
  family: 'Roboto',
  fonts: [{ src: '/fonts/Roboto-Regular.ttf' }, { src: '/fonts/Roboto-Bold.ttf' }],
});

const PAYMENT_LABELS = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia' };

const STATUS_LABELS = { completed: 'Completada', pending: 'Pendiente', cancelled: 'Cancelada' };

// ----------------------------------------------------------------------

export function SalePDFDownload({ sale, saleDetails, salePayments, productMap }) {
  const ready = !!sale;

  const renderButton = (loading) => (
    <Tooltip title="Descargar PDF">
      <span>
        <IconButton disabled={!ready || loading}>
          {loading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            <Iconify icon="eva:cloud-download-fill" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );

  if (!ready) return renderButton(false);

  return (
    <PDFDownloadLink
      document={
        <SalePdfDocument
          sale={sale}
          saleDetails={saleDetails}
          salePayments={salePayments}
          productMap={productMap}
        />
      }
      fileName={`venta-${sale.id}.pdf`}
      style={{ textDecoration: 'none' }}
    >
      {({ loading }) => renderButton(loading)}
    </PDFDownloadLink>
  );
}

// ----------------------------------------------------------------------

const useStyles = () =>
  useMemo(
    () =>
      StyleSheet.create({
        page: {
          fontSize: 9,
          lineHeight: 1.6,
          fontFamily: 'Roboto',
          backgroundColor: '#FFFFFF',
          padding: '40px 24px 100px 24px',
        },
        footer: {
          left: 0,
          right: 0,
          bottom: 0,
          padding: 24,
          margin: 'auto',
          borderTopWidth: 1,
          borderStyle: 'solid',
          position: 'absolute',
          borderColor: '#e9ecef',
        },
        row: { flexDirection: 'row' },
        spaceBetween: { flexDirection: 'row', justifyContent: 'space-between' },
        mb4: { marginBottom: 4 },
        mb8: { marginBottom: 8 },
        mb24: { marginBottom: 24 },
        mb40: { marginBottom: 40 },
        h3: { fontSize: 16, fontWeight: 700 },
        h4: { fontSize: 11, fontWeight: 700 },
        body1: { fontSize: 10 },
        body2: { fontSize: 9 },
        bold: { fontWeight: 700 },
        secondary: { color: '#637381' },
        badge: {
          fontSize: 9,
          fontWeight: 700,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          backgroundColor: '#e8f5e9',
          color: '#1b5e20',
        },
        // table
        table: { width: '100%', marginTop: 8 },
        tableRow: {
          flexDirection: 'row',
          padding: '8px 0',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#e9ecef',
        },
        tableHeader: { backgroundColor: '#f4f6f8', padding: '8px 0' },
        col1: { width: '5%' },
        col2: { width: '40%' },
        col3: { width: '12%', textAlign: 'right', paddingRight: 4 },
        col4: { width: '13%', textAlign: 'right', paddingRight: 4 },
        col5: { width: '13%', textAlign: 'right', paddingRight: 4 },
        col6: { width: '17%', textAlign: 'right' },
        noBorder: { borderBottomWidth: 0, paddingTop: 6, paddingBottom: 0 },
        // payment table
        pcol1: { width: '30%' },
        pcol2: { width: '25%', textAlign: 'right', paddingRight: 4 },
        pcol3: { width: '25%', paddingLeft: 8 },
        pcol4: { width: '20%', paddingLeft: 8 },
      }),
    []
  );

// ----------------------------------------------------------------------

function SalePdfDocument({ sale, saleDetails, salePayments, productMap }) {
  const styles = useStyles();

  const totalItems = saleDetails.reduce(
    (acc, d) =>
      acc + (Number(d.quantity) || 0) * Number(d.unit_price ?? 0) - Number(d.discount ?? 0),
    0
  );

  const totalPayments = salePayments.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  const renderHeader = () => (
    <View style={[styles.spaceBetween, styles.mb40]}>
      <View>
        <Image source="/logo/logo-single.png" style={{ width: 48, height: 48 }} />
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.h3, styles.mb4]}>Recibo de Venta</Text>
        <Text style={[styles.body2, styles.secondary]}>Venta #{sale?.id}</Text>
        <Text style={[styles.body2, styles.secondary, styles.mb4]}>
          {fDate(sale?.created_at ?? sale?.date_sale)}
        </Text>
        <Text style={[styles.badge]}>
          {STATUS_LABELS[sale?.status] ?? sale?.status ?? '—'}
        </Text>
      </View>
    </View>
  );

  const renderInfo = () => (
    <View style={[styles.spaceBetween, styles.mb40]}>
      <View style={{ width: '50%' }}>
        <Text style={[styles.body1, styles.bold, styles.mb4]}>Farmacia Selene</Text>
        <Text style={[styles.body2, styles.secondary]}>soporte@farmaciaselene.com</Text>
      </View>
      <View style={{ width: '50%', alignItems: 'flex-end' }}>
        <Text style={[styles.body1, styles.bold, styles.mb4]}>Información de venta</Text>
        {sale?.branch_id && (
          <Text style={[styles.body2, styles.secondary]}>Sucursal: {sale.branch_id}</Text>
        )}
        {sale?.description && (
          <Text style={[styles.body2, styles.secondary]}>Obs.: {sale.description}</Text>
        )}
      </View>
    </View>
  );

  const renderItemsTable = () => (
    <View style={styles.mb24}>
      <Text style={[styles.h4, styles.mb4]}>Productos</Text>
      <View style={styles.table}>
        {/* Header */}
        <View style={[styles.tableRow, styles.tableHeader]}>
          <View style={styles.col1}><Text style={styles.bold}>#</Text></View>
          <View style={styles.col2}><Text style={styles.bold}>Producto</Text></View>
          <View style={styles.col3}><Text style={styles.bold}>Cant.</Text></View>
          <View style={styles.col4}><Text style={styles.bold}>P. Unit.</Text></View>
          <View style={styles.col5}><Text style={styles.bold}>Desc.</Text></View>
          <View style={styles.col6}><Text style={styles.bold}>Subtotal</Text></View>
        </View>

        {/* Rows */}
        {saleDetails.map((d, i) => {
          const subtotal =
            (Number(d.quantity) || 0) * Number(d.unit_price ?? 0) - Number(d.discount ?? 0);
          const productName = productMap?.[d.product_id] ?? `Producto #${d.product_id}`;
          return (
            <View key={d.id} style={styles.tableRow}>
              <View style={styles.col1}><Text>{i + 1}</Text></View>
              <View style={styles.col2}>
                <Text style={styles.bold}>{productName}</Text>
                {d.description ? (
                  <Text style={[styles.body2, styles.secondary]}>{d.description}</Text>
                ) : null}
              </View>
              <View style={styles.col3}><Text>{d.quantity}</Text></View>
              <View style={styles.col4}><Text>{fCurrency(d.unit_price)}</Text></View>
              <View style={styles.col5}>
                <Text>{d.discount ? fCurrency(d.discount) : '—'}</Text>
              </View>
              <View style={styles.col6}><Text>{fCurrency(subtotal)}</Text></View>
            </View>
          );
        })}

        {/* Totals */}
        {[
          { label: 'Subtotal', value: totalItems },
          { label: 'Total', value: sale?.total ?? totalItems, bold: true },
        ].map((row) => (
          <View key={row.label} style={[styles.tableRow, styles.noBorder]}>
            <View style={styles.col1} />
            <View style={styles.col2} />
            <View style={styles.col3} />
            <View style={styles.col4} />
            <View style={styles.col5}>
              <Text style={row.bold ? styles.bold : undefined}>{row.label}</Text>
            </View>
            <View style={styles.col6}>
              <Text style={row.bold ? styles.bold : undefined}>{fCurrency(row.value)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  const renderPaymentsTable = () => {
    if (!salePayments.length) return null;
    return (
      <View style={styles.mb24}>
        <Text style={[styles.h4, styles.mb4]}>Pagos</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.pcol1}><Text style={styles.bold}>Método</Text></View>
            <View style={styles.pcol2}><Text style={styles.bold}>Monto</Text></View>
            <View style={styles.pcol3}><Text style={styles.bold}>N° Referencia</Text></View>
            <View style={styles.pcol4}><Text style={styles.bold}>Banco</Text></View>
          </View>
          {salePayments.map((p) => (
            <View key={p.id} style={styles.tableRow}>
              <View style={styles.pcol1}>
                <Text>{PAYMENT_LABELS[p.method_payment] ?? p.method_payment}</Text>
              </View>
              <View style={styles.pcol2}><Text>{fCurrency(p.amount)}</Text></View>
              <View style={styles.pcol3}><Text>{p.transaction_number ?? '—'}</Text></View>
              <View style={styles.pcol4}><Text>{p.bank ?? '—'}</Text></View>
            </View>
          ))}
          <View style={[styles.tableRow, styles.noBorder]}>
            <View style={styles.pcol1} />
            <View style={styles.pcol2}>
              <Text style={styles.bold}>{fCurrency(totalPayments)}</Text>
            </View>
            <View style={styles.pcol3} />
            <View style={styles.pcol4} />
          </View>
        </View>
      </View>
    );
  };

  const renderFooter = () => (
    <View style={[styles.spaceBetween, styles.footer]} fixed>
      <Text style={[styles.body2, styles.secondary]}>
        Generado el {fDate(new Date())} · Farmacia Selene
      </Text>
      <Text style={[styles.body2, styles.secondary]}>
        soporte@farmaciaselene.com
      </Text>
    </View>
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {renderHeader()}
        {renderInfo()}
        {renderItemsTable()}
        {renderPaymentsTable()}
        {renderFooter()}
      </Page>
    </Document>
  );
}
