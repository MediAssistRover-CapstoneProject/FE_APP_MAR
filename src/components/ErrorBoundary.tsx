import { Component, PropsWithChildren } from 'react';
import { AppText, Button, Card, Screen } from './ui';

export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) {
      return <Screen><Card>
        <AppText variant="heading">Ứng dụng cần tải lại</AppText>
        <AppText>Đã có lỗi khi hiển thị. Bạn vui lòng thử lại hoặc nhờ nhân viên gần nhất hỗ trợ.</AppText>
        <Button title="Thử lại" onPress={() => this.setState({ failed: false })} />
      </Card></Screen>;
    }
    return this.props.children;
  }
}
