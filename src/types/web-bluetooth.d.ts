// Deklarasi tipe minimal untuk Web Bluetooth API -- TypeScript lib.dom
// bawaan belum menyertakan tipe ini secara default.

interface BluetoothRemoteGATTCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface Bluetooth {
  requestDevice(options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
    filters?: any[];
  }): Promise<BluetoothDevice>;
}

interface Navigator {
  bluetooth?: Bluetooth;
}
