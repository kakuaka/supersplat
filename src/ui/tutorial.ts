// src/ui/tutorial.ts
import { Events } from '../events';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import apiClient from '../api/auth-client';

interface TutorialStep {
  element: string;  // DOM 元素选择器
  popover: {
    title: string;
    description: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'mid-center';
  };
}

class Tutorial {
  driver: any;
  events: Events;
  steps: TutorialStep[];
  private isAutoMode: boolean = true;
  private readonly TUTORIAL_COMPLETED_KEY = 'tutorialCompleted';
  private readonly USER_ID_KEY = 'USER_ID';

  constructor(events: Events) {
    this.events = events;
    this.steps = this.getDefaultSteps();
    
    // 初始化 Driver.js
    this.driver = driver({
      showProgress: true,
      animate: true,
      allowClose: true,
      doneBtnText: '完成',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      stagePadding: 5,
      steps: this.steps,
      onDestroyed: () => {
        // 教程结束前的回调
        console.log('Tutorial hasEnded', this.isAutoMode);
        if (this.isAutoMode) {
          this.markTutorialAsCompleted();
        }
      },

      onCloseClick: () => {
        // 关闭按钮点击后的回调
        console.log('Close button clicked', this.isAutoMode);
        if (confirm('确定要退出教程吗？退出后需要重新打开才能继续学习。')) {
          // this.events.fire('tutorial.cancelled');
          this.driver.destroy();
          return true;
        }
        return false;
      }
    });

  }
  
  private getDefaultSteps(): TutorialStep[] {
    return [
      {
        element: '#menu-bar',
        popover: {
          title: '欢迎使用模型编辑工具',
          description: '这是菜单区域，您可以在这里打开、保存和导出文件。',
        }
      },
      {
        element: '#scene-panel',
        popover: {
          title: '场景面板和变换工具',
          description: '显示当前场景中的所有对象及其变换参数。',
        }
      },
      {
        element: '#bottom-toolbar',
        popover: {
          title: '底部工具栏',
          description: '这里有各种选择和编辑工具，包括矩形选择、球选择、盒选择、平移、旋转、缩放和测量工具等。',
        }
      }, 
      {
        element: '#right-toolbar',
        popover: {
          title: '右侧工具栏',
          description: '在这里您可以进行显示/隐藏splat、相机切换、框选、重置相机、颜色和视图控制设置。',
        }
      },
      {
        element: '#view-cube-container',
        popover: {
          title: '坐标系工具',
          description: '通过此3D坐标系可快速切换视角方向，点击各轴可跳转到对应的标准视角。',
        }
      },
      {
        element: '#mode-toggle',
        popover: {
          title: '编辑模式切换',
          description: '您可以在这里进行中心模式和环状模式之间的切换。',
        }
      }
    ];
  }

  private getUserId(): string | null {
    const userId = localStorage.getItem(this.USER_ID_KEY);
    return userId && userId !== 'null' ? userId : null;
  }

  private async checkTutorialCompleted(): Promise<boolean> {
    const userId = this.getUserId();
    if (!userId) {
      return false;
    }
    const cacheKey = `${this.TUTORIAL_COMPLETED_KEY}_${this.USER_ID_KEY}`;
    const localCompleted = localStorage.getItem(cacheKey);
    if (localCompleted === 'true') {
      return true;
    }
    try {
      const response = await apiClient.get('/admin-api/system/user/get-user-notice-status', {
        params: { userId }
      });
      
      if (response.code === 0 && response.data?.noticeStatus > 0) {
        localStorage.setItem(cacheKey, 'true');
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to fetch tutorial status from server:', error);
      return false;
    }
  }

  async start() {
    try {
      const isCompleted = await this.checkTutorialCompleted();
      if (!isCompleted) {
        this.isAutoMode = true;
        this.driver.drive();
        // this.events.fire('tutorial.started');
      }
    } catch (error) {
      console.error('Failed to start tutorial:', error);
      this.driver.drive();
    }
  }

  forceStart() {
    console.log('Force start tutorial');
    this.isAutoMode = false;
    this.driver.drive();
    this.events.fire('tutorial.started');
  }

  private markTutorialAsCompleted(): void {
    const cacheKey = `${this.TUTORIAL_COMPLETED_KEY}_${this.USER_ID_KEY}`;
    localStorage.setItem(cacheKey, 'true');
    this.updateTutorialStatus();
  }

  private async updateTutorialStatus(): Promise<void> {
    console.log('----- updateTutorialStatus ----')
    const userId = this.getUserId();
    if (!userId) {
      return;
    }
    try {
      await apiClient.put('/admin-api/system/user/set-user-notice-status', {
        params: { userId: localStorage.getItem('USER_ID') },
      });
    } catch (error) {
      console.error(error);
    }
  }

}

export { Tutorial };